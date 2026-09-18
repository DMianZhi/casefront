import { expect, it } from 'vitest';
import { classify, splitByConfidence } from '../lib/classifier';
import { CONF_HIGH, CONF_THRESHOLD } from '../lib/constants';
import type { Candidate, ClassifiedElement, ElementConstraints, EnrichedCandidate } from '../lib/inventory';

type CandOver = Partial<Omit<Candidate, 'constraints'>>
  & { constraints?: Partial<ElementConstraints> }
  & Partial<Pick<ClassifiedElement, 'confidence' | 'interaction_type'>>;

const cand = (over: CandOver = {}): Candidate & Partial<EnrichedCandidate> => ({
  backendDOMNodeId: null, role: 'textbox', name: 'n', ignored: false, properties: [], constraints: {}, state: { disabled: false }, ...over,
} as Candidate & Partial<EnrichedCandidate>);

it('常规映射给高置信度', () => {
  const r = classify([cand(), cand({ role: 'combobox' }), cand({ role: 'checkbox', name: '同意' }),
    cand({ role: 'textbox', properties: [{ name: 'multiline', value: { type: 'boolean', value: true } }] }),
    cand({ role: 'button', constraints: { input_type: 'file' } })]);
  expect(r[0]!.interaction_type).toBe('text_input');
  expect(r[1]!.interaction_type).toBe('select');
  expect(r[2]!.interaction_type).toBe('checkbox');
  expect(r[3]!.interaction_type).toBe('textarea');
  expect(r[4]!.interaction_type).toBe('file_upload');
  expect(r.every(x => x.confidence === CONF_HIGH)).toBeTruthy();
});

it('input_type=date 走 date_picker；低信心项由 splitByConfidence 分流', () => {
  const r = classify([cand({ role: 'button', constraints: { input_type: 'date' } })]);
  expect(r[0]!.interaction_type).toBe('date_picker');
  const [sure, review, unclassified] = splitByConfidence(r);
  expect(sure.length).toBe(1);
  expect(review.length).toBe(0);
  expect(unclassified.length).toBe(0);
  const [s2, r2] = splitByConfidence([cand({ confidence: 0.6, interaction_type: 'pagination' }) as unknown as ClassifiedElement]);
  expect(s2.length).toBe(0);
  expect(r2.length).toBe(1);
  expect(CONF_THRESHOLD === 0.9).toBeTruthy();
});
