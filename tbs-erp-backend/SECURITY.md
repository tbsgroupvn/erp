# Security Guidelines

## Environment Variables & Secrets Management

### CRITICAL: Never Commit Secrets to Version Control

The `.env` file contains sensitive credentials and MUST NEVER be committed to Git.

**✅ Safe:**
- `.env.example` - Template with placeholder values
- Configuration documentation

**❌ Dangerous:**
- `.env` - Contains real credentials
- Hardcoded secrets in code
- Secrets in commit history

### Generating Strong Secrets

Always use cryptographically secure random values for JWT secrets:

```bash
# Generate JWT_SECRET (128 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT_REFRESH_SECRET (128 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Minimum Requirements:**
- JWT secrets: 128+ characters (64 bytes hex-encoded)
- Database passwords: 32+ characters with mixed case, numbers, symbols
- API keys: Use provider-generated keys

### Production Secret Management

**DO NOT** store secrets in environment variables in production. Use:

- **AWS Secrets Manager** (recommended for AWS)
- **Azure Key Vault** (recommended for Azure)
- **HashiCorp Vault** (multi-cloud)
- **Google Cloud Secret Manager** (recommended for GCP)

Example with AWS Secrets Manager:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: 'tbs-erp/jwt-secret' })
);
const jwtSecret = JSON.parse(response.SecretString).JWT_SECRET;
```

### Environment-Specific Configuration

Use different secrets for each environment:

- **Development**: Auto-generated, stored in local `.env`
- **Staging**: Rotated monthly, stored in secrets manager
- **Production**: Rotated weekly, stored in secrets manager with audit logging

### Secret Rotation Policy

- **JWT secrets**: Rotate every 90 days
- **Database passwords**: Rotate every 30 days
- **API keys**: Rotate when compromised or annually
- **Refresh tokens**: Implement automatic rotation on use

### Checklist Before Deployment

- [ ] All secrets are stored in secrets manager (not `.env`)
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in application code
- [ ] Secrets are environment-specific
- [ ] Audit logging enabled for secret access
- [ ] Secret rotation schedule established
- [ ] Access to secrets restricted by IAM/RBAC

### Security Monitoring

Enable alerts for:
- Failed authentication attempts (>5 in 1 minute)
- Secret access from unexpected IPs
- Privilege escalation attempts
- Unusual API usage patterns

### Incident Response

If secrets are compromised:

1. **Immediately** rotate all affected secrets
2. Invalidate all active sessions/tokens
3. Audit access logs for unauthorized use
4. Notify security team
5. Update incident log
6. Review and improve security measures

### Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
