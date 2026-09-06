import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyV1DirectMachineToken } from '../lib/oauth/v1/signer.js';

export const WORKFLOW_ADMISSION_PRINCIPAL = 'cedb954a-3d99-4e5a-b568-d312441bcc56';
export const WORKFLOW_ADMISSION_CLIENT = 'svc-workflow-canonical-admission-v1';
export const WORKFLOW_ADMISSION_AUDIENCE = 'workflow-principal-admission';
export const WORKFLOW_ADMISSION_SCOPE = 'auth.agent.admission.read';

export class WorkflowAdmissionAuthError extends Error {
  constructor(public readonly status: 401 | 403, public readonly code: string) {
    super(code);
  }
}

// Invoked inside the route's whole-operation deadline, before any target read.
// Only the existing V1 verifier interprets JWTs; no second token protocol.
export async function authenticateWorkflowAdmission(req: Request): Promise<void> {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  let claims;
  try {
    if (!token) throw new Error('missing');
    claims = verifyV1DirectMachineToken(token, WORKFLOW_ADMISSION_AUDIENCE);
  } catch {
    throw new WorkflowAdmissionAuthError(401, 'UNAUTHORIZED');
  }
  if (claims.principal_type !== 'service'
    || claims.sub !== WORKFLOW_ADMISSION_PRINCIPAL
    || claims.client_id !== WORKFLOW_ADMISSION_CLIENT
    || claims.scope !== WORKFLOW_ADMISSION_SCOPE) {
    throw new WorkflowAdmissionAuthError(403, 'ACCESS_DENIED');
  }
  const [principal, client] = await Promise.all([
    prisma.machinePrincipal.findUnique({
      where: { id: claims.sub },
      select: { id: true, principalType: true, agentId: true, status: true },
    }),
    prisma.machineClient.findUnique({
      where: { clientId: claims.client_id },
      select: { clientId: true, machinePrincipalId: true, status: true },
    }),
  ]);
  if (!principal || !client || principal.id !== claims.sub
    || client.clientId !== claims.client_id || client.machinePrincipalId !== claims.sub) {
    throw new WorkflowAdmissionAuthError(401, 'UNAUTHORIZED');
  }
  if (principal.status !== 'active' || client.status !== 'active'
    || principal.principalType !== 'service' || principal.agentId !== null) {
    throw new WorkflowAdmissionAuthError(403, 'ACCESS_DENIED');
  }
}
