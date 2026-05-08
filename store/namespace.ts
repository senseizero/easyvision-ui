import { KIND_SUFFIX, type SliceKind } from './slice-types';

export const fullIdOf = (id: string, kind: SliceKind): string =>
  `${id}${KIND_SUFFIX[kind]}`;

export const childIdOf = (parentFullId: string, childLocalId: string): string =>
  `${parentFullId}.${childLocalId}`;

export const childFullIdOf = (
  parentFullId: string | null,
  childLocalId: string,
  childKind: SliceKind
): string =>
  parentFullId
    ? `${childIdOf(parentFullId, childLocalId)}${KIND_SUFFIX[childKind]}`
    : fullIdOf(childLocalId, childKind);
