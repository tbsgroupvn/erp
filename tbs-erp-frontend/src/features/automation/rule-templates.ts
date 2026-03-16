import type { CreateAutomationRuleDto } from '@/lib/types/automation.types';

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'order' | 'finance' | 'complaint' | 'task' | 'approval' | 'schedule';
  rule: Omit<CreateAutomationRuleDto, 'name' | 'description'>;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Don moi > 10 trieu → Thong bao Sales Director',
    description: 'Khi co don hang moi gia tri lon, tu dong thong bao Sales Director de theo doi.',
    category: 'order',
    rule: {
      trigger: {
        type: 'ORDER_CREATED',
        params: {},
      },
      conditions: [
        { field: 'order.totalAmount', operator: 'gt', value: '10000000' },
      ],
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: 'ROLE:SALES_DIRECTOR',
            message: 'Don hang moi {{order.code}} tri gia {{order.totalAmount}} VND tu KH {{order.customerName}}',
          },
        },
      ],
    },
  },
  {
    id: 'tpl-2',
    name: 'Thanh toan den → Tu dong gach no',
    description: 'Khi nhan thanh toan, tu dong tao task cho ke toan gach no cong no phai thu.',
    category: 'finance',
    rule: {
      trigger: {
        type: 'PAYMENT_RECEIVED',
        params: {},
      },
      conditions: [],
      actions: [
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Gach no cong no phai thu - {{payment.customerName}} - {{payment.amount}} VND',
            assigneeId: 'ROLE:ACCOUNTANT_AR',
            priority: 'HIGH',
            dueInDays: 1,
          },
        },
      ],
    },
  },
  {
    id: 'tpl-3',
    name: 'Khieu nai moi → Tao task cho CSKH',
    description: 'Khi khach hang khieu nai, tu dong tao task cho bo phan CSKH xu ly trong 24h.',
    category: 'complaint',
    rule: {
      trigger: {
        type: 'COMPLAINT_OPENED',
        params: {},
      },
      conditions: [],
      actions: [
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Xu ly khieu nai {{complaint.code}} - KH {{complaint.customerName}}',
            assigneeId: 'ROLE:CSKH',
            priority: 'URGENT',
            dueInDays: 1,
          },
        },
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: 'ROLE:CSKH',
            message: 'Khieu nai moi {{complaint.code}} can xu ly gap',
          },
        },
      ],
    },
  },
  {
    id: 'tpl-4',
    name: 'Container den VN → Thong bao KH',
    description: 'Khi container cap cang VN, thong bao tat ca khach hang co hang trong container.',
    category: 'order',
    rule: {
      trigger: {
        type: 'ORDER_STATUS_CHANGED',
        params: { statusFrom: 'IN_TRANSIT', statusTo: 'ARRIVED' },
      },
      conditions: [],
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: '{{order.customerId}}',
            message: 'Hang cua ban da den kho VN. Don hang {{order.code}} dang cho thong quan.',
          },
        },
      ],
    },
  },
  {
    id: 'tpl-5',
    name: 'Don qua han dat coc → Nhac KH',
    description: 'Don hang trang thai CONFIRMED qua 3 ngay chua dat coc, gui nhac nho.',
    category: 'schedule',
    rule: {
      trigger: {
        type: 'SCHEDULE_DAILY',
        params: { scheduleTime: '09:00' },
      },
      conditions: [
        { field: 'order.status', operator: 'eq', value: 'CONFIRMED' },
        { field: 'order.daysSinceCreated', operator: 'gt', value: '3' },
      ],
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: '{{order.saleId}}',
            message: 'Don {{order.code}} da 3+ ngay chua dat coc. Lien he KH {{order.customerName}} de nhac coc.',
          },
        },
      ],
    },
  },
  {
    id: 'tpl-6',
    name: 'Hang ve kho VN → De xuat hoa don',
    description: 'Khi don hang chuyen sang DELIVERING, tu dong tao task lap hoa don.',
    category: 'order',
    rule: {
      trigger: {
        type: 'ORDER_STATUS_CHANGED',
        params: { statusFrom: 'CUSTOMS', statusTo: 'DELIVERING' },
      },
      conditions: [],
      actions: [
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Lap hoa don cho don {{order.code}} - KH {{order.customerName}}',
            assigneeId: 'ROLE:ACCOUNTANT',
            priority: 'MEDIUM',
            dueInDays: 2,
          },
        },
      ],
    },
  },
  {
    id: 'tpl-7',
    name: 'Phe duyet xong → Thong bao nguoi tao',
    description: 'Khi yeu cau phe duyet duoc duyet/tu choi, thong bao lai cho nguoi tao.',
    category: 'approval',
    rule: {
      trigger: {
        type: 'APPROVAL_COMPLETED',
        params: {},
      },
      conditions: [],
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: '{{approval.requesterId}}',
            message: 'Yeu cau phe duyet "{{approval.title}}" da duoc {{approval.result}} boi {{approval.approverName}}',
          },
        },
      ],
    },
  },
  {
    id: 'tpl-8',
    name: 'Task qua han → Nhac nguoi duoc giao',
    description: 'Task qua han deadline, gui nhac nho va thong bao quan ly.',
    category: 'task',
    rule: {
      trigger: {
        type: 'TASK_OVERDUE',
        params: {},
      },
      conditions: [],
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: '{{task.assigneeId}}',
            message: 'Task "{{task.title}}" da qua han! Vui long cap nhat tien do.',
          },
        },
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: '{{task.createdBy}}',
            message: 'Task "{{task.title}}" giao cho {{task.assigneeName}} da qua han.',
          },
        },
      ],
    },
  },
  {
    id: 'tpl-9',
    name: 'Don hoan thanh → Tinh hoa hong',
    description: 'Khi don hang COMPLETED, thong bao ke toan tinh hoa hong cho sale.',
    category: 'order',
    rule: {
      trigger: {
        type: 'ORDER_STATUS_CHANGED',
        params: { statusFrom: 'DELIVERING', statusTo: 'COMPLETED' },
      },
      conditions: [],
      actions: [
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Tinh hoa hong don {{order.code}} cho {{order.saleName}}',
            assigneeId: 'ROLE:CHIEF_ACCOUNTANT',
            priority: 'MEDIUM',
            dueInDays: 3,
          },
        },
      ],
    },
  },
  {
    id: 'tpl-10',
    name: 'Bao cao hang ngay 8h sang',
    description: 'Gui bao cao tong hop moi sang 8h cho ban giam doc.',
    category: 'schedule',
    rule: {
      trigger: {
        type: 'SCHEDULE_DAILY',
        params: { scheduleTime: '08:00' },
      },
      conditions: [],
      actions: [
        {
          type: 'SEND_NOTIFICATION',
          params: {
            userId: 'ROLE:CEO',
            message: 'Bao cao sang: Don moi hom qua: {{stats.newOrders}}, Doanh thu: {{stats.revenue}} VND, Container dang van chuyen: {{stats.inTransitContainers}}',
          },
        },
      ],
    },
  },
];

export function getTemplatesByCategory(category: string): RuleTemplate[] {
  return RULE_TEMPLATES.filter((t) => t.category === category);
}
