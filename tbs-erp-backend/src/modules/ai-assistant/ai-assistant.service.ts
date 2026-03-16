import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { AI_TOOLS, executeTool } from './tools/tool-registry';
import { AiGuardrailsService } from './guards/ai-guardrails.service';

const SYSTEM_PROMPT = `Ban la TBS Assistant - tro ly AI noi bo cua TBS Group, cong ty logistics chuyen ve van chuyen hang hoa Trung Quoc - Viet Nam.

Ban co the giup nhan vien:
- Tra cuu thong tin don hang, khach hang, container, kien hang, cong no
- Giai thich quy trinh nghiep vu (van chuyen, thong quan, kho TQ/VN)
- Ho tro tinh toan chi phi, ty gia, phi dich vu
- Tra loi cau hoi ve chinh sach noi bo
- Huong dan su dung he thong TBS ERP

Ban co cac cong cu (tools) de truy van du lieu truc tiep tu he thong. HAY SU DUNG TOOLS khi nguoi dung hoi ve so lieu cu the (bao nhieu don, tong doanh thu, danh sach khach hang, v.v.).

Tra loi ngan gon, chinh xac bang tieng Viet. Khi tra ve ket qua tu tools, trinh bay bang hoac danh sach de doc.`;

// ─── Shared session context resolved before each call ───────────────────────
interface SessionContext {
  session: { id: string; messages: Array<{ role: string; content: string }> };
  userRole: string;
  cleanMessage: string;
  history: MessageParam[];
  systemPrompt: string;
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly guardrails: AiGuardrailsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: config.get<string>('ANTHROPIC_API_KEY', ''),
    });
    this.model = config.get<string>('AI_CHAT_MODEL', 'claude-haiku-4-5-20251001');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers shared by chat() and chatStream()
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolves (or creates) the session, loads user role, builds message history
   * and the composed system prompt.  Called at the start of both chat() and
   * chatStream() after guardrails have already sanitised the input.
   */
  private async buildSessionContext(
    userId: string,
    sessionId: string,
    cleanMessage: string,
  ): Promise<SessionContext> {
    // Lay hoac tao session
    let session = await this.prisma.aIChatSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
    });

    if (!session) {
      session = await this.prisma.aIChatSession.create({
        data: { userId },
        include: { messages: true },
      });
    }

    // Lay user role de truyen vao tools
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const userRole = user?.role || 'SALE';

    // Xay dung lich su tin nhan cho Claude
    const history: MessageParam[] = session.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    history.push({ role: 'user', content: cleanMessage });

    const systemPrompt = `${SYSTEM_PROMPT}\n${this.guardrails.getSecuritySystemPrompt()}\n\nVai tro nguoi dung: ${userRole}`;

    return { session, userRole, cleanMessage, history, systemPrompt };
  }

  /**
   * Executes all tool_use blocks in a single Claude response and returns the
   * array of tool_result items ready to be pushed back into the messages list.
   * Also accumulates tool names into the provided array (for audit purposes).
   */
  private async processToolUseBlocks(
    responseContent: Anthropic.Messages.ContentBlock[],
    userId: string,
    userRole: string,
    toolNamesUsed: string[],
    logPrefix: string,
  ): Promise<Array<{ type: 'tool_result'; tool_use_id: string; content: string }>> {
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const block of responseContent) {
      if (block.type === 'tool_use') {
        this.logger.log(`${logPrefix}Tool call: ${block.name} (id=${block.id})`);
        toolNamesUsed.push(block.name);

        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          this.prisma,
          userId,
          userRole,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    return toolResults;
  }

  /**
   * Saves both the user message and the assistant reply to the DB, and sets
   * the session title from the first message when the session is brand new.
   */
  private async saveConversationMessages(
    sessionId: string,
    sessionMessageCount: number,
    cleanMessage: string,
    assistantMessage: string,
    totalTokens: number,
    saveUserMessage: boolean,
  ): Promise<void> {
    if (saveUserMessage) {
      await this.prisma.aIMessage.createMany({
        data: [
          { sessionId, role: 'user', content: cleanMessage },
          { sessionId, role: 'assistant', content: assistantMessage, tokens: totalTokens },
        ],
      });
    } else {
      // User message was already saved before streaming started
      await this.prisma.aIMessage.create({
        data: { sessionId, role: 'assistant', content: assistantMessage, tokens: totalTokens },
      });
    }

    // Tu dat tieu de session tu tin nhan dau tien
    if (sessionMessageCount === 0) {
      const title =
        cleanMessage.length > 50 ? cleanMessage.slice(0, 50) + '...' : cleanMessage;
      await this.prisma.aIChatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }
  }

  /**
   * Ghi audit log cho AI chat mot cach an toan (non-blocking).
   * Loi ghi log khong lam hong chat — chi log error va bo qua.
   */
  private async safeAuditLog(data: {
    userId: string;
    sessionId: string;
    tokensUsed: number;
    toolsUsed: string[];
    streaming?: boolean;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: 'AI_CHAT',
          entity: 'AIChatSession',
          entityId: data.sessionId,
          newData: {
            tokensUsed: data.tokensUsed,
            toolsUsed: data.toolsUsed,
            model: this.model,
            ...(data.streaming ? { streaming: true } : {}),
          },
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to create audit log for AI_CHAT session ${data.sessionId}: ${err.message}`,
        err.stack,
      );
      // Do not throw — audit failure must not break chat
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public session management
  // ─────────────────────────────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.prisma.aIChatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async createSession(userId: string) {
    return this.prisma.aIChatSession.create({
      data: { userId },
    });
  }

  async deleteSession(userId: string, sessionId: string) {
    await this.prisma.aIChatSession.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  async getMessages(userId: string, sessionId: string) {
    const session = await this.prisma.aIChatSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return session?.messages ?? [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // chat() — non-streaming, with tool_use loop
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Gui tin nhan va nhan phan hoi AI (khong streaming, co tool_use)
   */
  async chat(
    userId: string,
    sessionId: string,
    userMessage: string,
  ): Promise<{ message: string; sessionId: string; tokensUsed: number }> {
    // Kiem tra guardrails input
    const inputCheck = this.guardrails.checkInput(userMessage);
    if (!inputCheck.allowed) {
      return {
        message: inputCheck.reason || 'Yeu cau khong hop le.',
        sessionId,
        tokensUsed: 0,
      };
    }
    const cleanMessage = inputCheck.sanitizedInput || userMessage;

    const { session, userRole, history, systemPrompt } = await this.buildSessionContext(
      userId,
      sessionId,
      cleanMessage,
    );

    // Goi Claude API voi tool_use loop
    let totalTokens = 0;
    let assistantMessage = '';
    const toolNamesUsed: string[] = [];
    const messages: MessageParam[] = [...history];

    // Tool use loop: toi da 5 vong
    for (let i = 0; i < 5; i++) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        tools: AI_TOOLS,
        messages,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      if (response.stop_reason === 'tool_use') {
        // AI muon goi tool — them response content vao messages
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = await this.processToolUseBlocks(
          response.content,
          userId,
          userRole,
          toolNamesUsed,
          '',
        );
        messages.push({ role: 'user', content: toolResults });
      } else {
        // AI tra loi text — lay noi dung va ket thuc loop
        const textBlock = response.content.find((c) => c.type === 'text');
        assistantMessage = textBlock?.type === 'text' ? textBlock.text : '';
        break;
      }
    }

    if (!assistantMessage) {
      assistantMessage = 'Xin loi, toi khong the tra loi ngay luc nay.';
    }

    // Kiem tra guardrails output
    const outputCheck = this.guardrails.checkOutput(assistantMessage);
    if (outputCheck.warnings.length > 0) {
      this.logger.warn(`Output guardrail: ${outputCheck.warnings.join('; ')}`);
    }

    await this.saveConversationMessages(
      session.id,
      session.messages.length,
      cleanMessage,
      assistantMessage,
      totalTokens,
      true, // saveUserMessage = true for non-streaming path
    );

    // Audit log (non-blocking)
    void this.safeAuditLog({
      userId,
      sessionId: session.id,
      tokensUsed: totalTokens,
      toolsUsed: [...new Set(toolNamesUsed)],
    });

    return { message: assistantMessage, sessionId: session.id, tokensUsed: totalTokens };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // chatStream() — Server-Sent Events with tool_use loop
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Stream phan hoi AI qua Server-Sent Events (async generator).
   * Ho tro tool_use loop toi da 3 vong, emit SSE events cho moi buoc:
   *   { type: 'session', sessionId }
   *   { type: 'tool_use', name, status: 'calling' | 'done' }
   *   { type: 'tool_result', name, preview }
   *   { type: 'text', text }
   *   { type: 'done', tokensUsed }
   */
  async *chatStream(
    userId: string,
    sessionId: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    // Guardrails input
    const inputCheck = this.guardrails.checkInput(userMessage);
    if (!inputCheck.allowed) {
      yield `data: ${JSON.stringify({ type: 'text', text: inputCheck.reason || 'Yeu cau khong hop le.' })}\n\n`;
      yield `data: ${JSON.stringify({ type: 'done', tokensUsed: 0 })}\n\n`;
      return;
    }
    const cleanMessage = inputCheck.sanitizedInput || userMessage;

    const { session, userRole, history, systemPrompt } = await this.buildSessionContext(
      userId,
      sessionId,
      cleanMessage,
    );

    // Luu tin nhan user truoc khi bat dau stream
    await this.prisma.aIMessage.create({
      data: { sessionId: session.id, role: 'user', content: cleanMessage },
    });

    yield `data: ${JSON.stringify({ type: 'session', sessionId: session.id })}\n\n`;

    let totalTokens = 0;
    let fullResponse = '';
    const toolNamesUsed: string[] = [];
    const messages: MessageParam[] = [...history];

    // Tool_use loop toi da 3 vong (giong chat() nhung co streaming sau vong cuoi)
    for (let round = 0; round < 3; round++) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        tools: AI_TOOLS,
        messages,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      // Neu co partial text blocks truoc tool_use, stream chung
      for (const block of response.content) {
        if (block.type === 'text' && block.text) {
          const chunkSize = 20;
          for (let i = 0; i < block.text.length; i += chunkSize) {
            const text = block.text.slice(i, i + chunkSize);
            yield `data: ${JSON.stringify({ type: 'text', text })}\n\n`;
          }
          fullResponse += block.text;
        }
      }

      if (response.stop_reason !== 'tool_use') {
        // AI da tra loi text — ket thuc loop
        // Neu fullResponse da co du lieu tu loop tren, khong can stream lai
        if (!fullResponse) {
          const textBlock = response.content.find((c) => c.type === 'text');
          if (textBlock?.type === 'text') {
            const chunkSize = 20;
            for (let i = 0; i < textBlock.text.length; i += chunkSize) {
              const text = textBlock.text.slice(i, i + chunkSize);
              yield `data: ${JSON.stringify({ type: 'text', text })}\n\n`;
            }
            fullResponse = textBlock.text;
          }
        }
        break;
      }

      // AI muon goi tool — xu ly va emit SSE events
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          // Emit: tool dang duoc goi
          yield `data: ${JSON.stringify({ type: 'tool_use', name: block.name, status: 'calling' })}\n\n`;

          this.logger.log(`[Stream] Tool call vong ${round + 1}: ${block.name} (id=${block.id})`);

          const singleResult = await this.processToolUseBlocks(
            [block],
            userId,
            userRole,
            toolNamesUsed,
            '[Stream] ',
          );
          const result = singleResult[0];
          toolResults.push(result);

          // Trich xuat preview ngan gon de hien thi cho user
          let preview = 'Hoan tat';
          try {
            const parsed = JSON.parse(result.content) as Record<string, unknown>;
            const count = parsed.count ?? parsed.tongSoDon ?? parsed.soPhieu ?? parsed.soKien;
            if (count !== undefined) {
              preview = `Tim thay ${count} ket qua`;
            }
          } catch {
            // Bo qua loi parse preview
          }

          // Emit: tool da xong, kem preview
          yield `data: ${JSON.stringify({ type: 'tool_use', name: block.name, status: 'done' })}\n\n`;
          yield `data: ${JSON.stringify({ type: 'tool_result', name: block.name, preview })}\n\n`;
        }
      }

      messages.push({ role: 'user', content: toolResults });

      // Sau vong cuoi (round 2), neu van con tool_use — goi stream de lay phan hoi cuoi
      if (round === 2) {
        const finalStream = await this.anthropic.messages.stream({
          model: this.model,
          max_tokens: 2048,
          system: systemPrompt,
          messages,
        });

        for await (const chunk of finalStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullResponse += text;
            yield `data: ${JSON.stringify({ type: 'text', text })}\n\n`;
          }
        }

        const finalMsg = await finalStream.finalMessage();
        totalTokens += finalMsg.usage.input_tokens + finalMsg.usage.output_tokens;
        break;
      }
    }

    // Fallback neu AI khong tra ve text
    if (!fullResponse) {
      fullResponse = 'Xin loi, toi khong the tra loi ngay luc nay.';
      yield `data: ${JSON.stringify({ type: 'text', text: fullResponse })}\n\n`;
    }

    // Kiem tra guardrails output
    const outputCheck = this.guardrails.checkOutput(fullResponse);
    if (outputCheck.warnings.length > 0) {
      this.logger.warn(`[Stream] Output guardrail: ${outputCheck.warnings.join('; ')}`);
    }

    await this.saveConversationMessages(
      session.id,
      session.messages.length,
      cleanMessage,
      fullResponse,
      totalTokens,
      false, // saveUserMessage = false — already saved before streaming
    );

    // Audit log (non-blocking — loi ghi log khong chan stream)
    void this.safeAuditLog({
      userId,
      sessionId: session.id,
      tokensUsed: totalTokens,
      toolsUsed: [...new Set(toolNamesUsed)],
      streaming: true,
    });

    yield `data: ${JSON.stringify({ type: 'done', tokensUsed: totalTokens })}\n\n`;
  }
}
