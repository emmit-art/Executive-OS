export const statuses = new Set(['completed','needs_clarification','awaiting_approval','failed']);
const sensitive = /^(send_|calendar_|financial_|delete_|spend_|transfer_|invest_|borrow_|legal_|purchase_|payment_)/;
const safeCompleted = new Set(['none','create_task','update_task','search_records','save_record','search_email']);
export function normalizeMakeResponse(raw, requestId, threadId) {
  let data;
  try { data=JSON.parse(raw); } catch { throw new Error('Make returned invalid JSON. No successful result was recorded.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !statuses.has(data.status) ||
      typeof data.reply !== 'string' || !data.reply.trim() || typeof data.requires_approval !== 'boolean' ||
      typeof data.action_type !== 'string' || !data.action_type.trim()) throw new Error('Make returned an invalid response contract.');
  if (data.request_id !== requestId || data.thread_id !== threadId) throw new Error('Make response identifiers did not match this request.');
  const changes=data.proposed_changes ?? {};
  const ids=data.record_ids ?? [];
  if (typeof changes !== 'object' || Array.isArray(changes) || !Array.isArray(ids) || ids.some(x=>typeof x!=='string')) throw new Error('Make returned invalid proposal or record data.');
  if ((data.status==='awaiting_approval') !== data.requires_approval) throw new Error('Make returned inconsistent approval status.');
  if (data.status==='awaiting_approval' && (!Object.keys(changes).length || data.action_type==='none' || ids.length)) throw new Error('Make returned an incomplete approval proposal or reported writes before approval.');
  if (data.status==='needs_clarification' && ids.length) throw new Error('Make reported a write while clarification was required.');
  if (data.status==='completed' && (sensitive.test(data.action_type) || !safeCompleted.has(data.action_type))) throw new Error('An unsupported or sensitive action was reported completed without the approval executor.');
  return {...data,proposed_changes:changes,record_ids:ids};
}
export function validateDecision(body) {
  if (!/^[0-9a-f-]{36}$/i.test(body.action_id ?? '') || !/^[0-9a-f]{64}$/i.test(body.proposal_hash ?? '') || !['approve','decline'].includes(body.decision)) throw new Error('A valid action ID, proposal hash, and decision are required.');
}
