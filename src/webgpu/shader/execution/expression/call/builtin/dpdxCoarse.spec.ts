export const description = `
Execution tests for the 'dpdxCoarse' builtin function

T is f32 or vecN<f32>
fn dpdxCoarse(e:T) ->T
Returns the partial derivative of e with respect to window x coordinates using local differences.
This may result in fewer unique positions that dpdxFine(e).
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#derivative-builtin-functions')
  .desc(`f32 tests`)
  .params(u =>
    u
      .combine('inputSource', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
