import {
  range,
  reorder,
  kReorderOrderKeys,
  ReorderOrder,
} from '../../../../../common/util/util.js';
import { GPUConst } from '../../../../constants.js';

import {
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  kBindGroupTests,
  kBindingCombinations,
  getPipelineTypeForBindingCombination,
  getPerStageWGSLForBindingCombination,
  LimitsRequest,
} from './limit_utils.js';

const kExtraLimits: LimitsRequest = {
  maxFragmentCombinedOutputResources: 'adapterLimit',
};

const limit = 'maxStorageBuffersPerShaderStage';
export const { g, description } = makeLimitTestGroup(limit);

function createBindGroupLayout(
  device: GPUDevice,
  visibility: number,
  type: GPUBufferBindingType,
  order: ReorderOrder,
  numBindings: number
) {
  return device.createBindGroupLayout({
    entries: reorder(
      order,
      range(numBindings, i => ({
        binding: i,
        visibility,
        buffer: { type },
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
      .combine('visibility', [
        GPUConst.ShaderStage.VERTEX,
        GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
      ])
      .combine('type', ['storage', 'read-only-storage'] as GPUBufferBindingType[])
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order, type } = t.params;

    if (visibility & GPUConst.ShaderStage.VERTEX && type === 'storage') {
      // vertex stage does not support storage buffers
      return;
    }

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        await t.expectValidationError(() => {
          createBindGroupLayout(device, visibility, type, order, testValue);
        }, shouldError);
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
      .combine('visibility', [
        GPUConst.ShaderStage.VERTEX,
        GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
      ])
      .combine('type', ['storage', 'read-only-storage'] as GPUBufferBindingType[])
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order, type } = t.params;

    if (visibility & GPUConst.ShaderStage.VERTEX && type === 'storage') {
      // vertex stage does not support storage buffers
      return;
    }

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const kNumGroups = 3;
        const bindGroupLayouts = range(kNumGroups, i => {
          const minInGroup = Math.floor(testValue / kNumGroups);
          const numInGroup = i ? minInGroup : testValue - minInGroup * (kNumGroups - 1);
          return createBindGroupLayout(device, visibility, type, order, numInGroup);
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
          (i, j) => `var<storage> u${j}_${i}: f32`,
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
      },
      kExtraLimits
    );
  });
