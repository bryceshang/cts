import {
  range,
  reorder,
  kReorderOrderKeys,
  ReorderOrder,
} from '../../../../../common/util/util.js';
import { kShaderStageCombinationsWithStage } from '../../../../capability_info.js';

import {
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  kBindGroupTests,
  kBindingCombinations,
  getPipelineTypeForBindingCombination,
  getPerStageWGSLForBindingCombination,
} from './limit_utils.js';

const limit = 'maxUniformBuffersPerShaderStage';
export const { g, description } = makeLimitTestGroup(limit);

function createBindGroupLayout(
  device: GPUDevice,
  visibility: number,
  order: ReorderOrder,
  numBindings: number
) {
  return device.createBindGroupLayout({
    entries: reorder(
      order,
      range(numBindings, i => ({
        binding: i,
        visibility,
        buffer: {},
      }))
    ),
  });
}

g.test('createBindGroupLayout,at_over')
  .desc(
    `
  Test using at and over ${limit} limit in createBindGroupLayout
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('visibility', kShaderStageCombinationsWithStage)
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        await t.expectValidationError(
          () => createBindGroupLayout(device, visibility, order, testValue),
          shouldError
        );
      }
    );
  });

g.test('createPipelineLayout,at_over')
  .desc(
    `
  Test using at and over ${limit} limit in createPipelineLayout
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('visibility', kShaderStageCombinationsWithStage)
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const kNumGroups = 3;
        const bindGroupLayouts = range(kNumGroups, i => {
          const minInGroup = Math.floor(testValue / kNumGroups);
          const numInGroup = i ? minInGroup : testValue - minInGroup * (kNumGroups - 1);
          return createBindGroupLayout(device, visibility, order, numInGroup);
        });
        await t.expectValidationError(
          () => device.createPipelineLayout({ bindGroupLayouts }),
          shouldError
        );
      }
    );
  });

g.test('createPipeline,at_over')
  .desc(
    `
  Test using createRenderPipeline(Async) and createComputePipeline(Async) at and over ${limit} limit
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('async', [false, true] as const)
      .combine('bindingCombination', kBindingCombinations)
      .combine('order', kReorderOrderKeys)
      .combine('bindGroupTest', kBindGroupTests)
  )
  .fn(async t => {
    const { limitTest, testValueName, async, bindingCombination, order, bindGroupTest } = t.params;
    const pipelineType = getPipelineTypeForBindingCombination(bindingCombination);

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const code = getPerStageWGSLForBindingCombination(
          bindingCombination,
          order,
          bindGroupTest,
          (i, j) => `var<uniform> u${j}_${i}: f32`,
          (i, j) => `_ = u${j}_${i};`,
          testValue
        );
        const module = device.createShaderModule({ code });

        await t.testCreatePipeline(
          pipelineType,
          async,
          module,
          shouldError,
          `actualLimit: ${actualLimit}, testValue: ${testValue}\n:${code}`
        );
      }
    );
  });
