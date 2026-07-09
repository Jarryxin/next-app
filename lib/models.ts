function parseArrayEnv(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* not JSON, fall through to comma-separated */
  }
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface ModelMeta {
  id: string;
  provider: string;
  providerLabel: string;
  label: string;
}

export interface ModelGroup {
  provider: string;
  providerLabel: string;
  models: { id: string; label: string }[];
}

const agnesModel = process.env.AGNES_MODEL || "agnes-2.0-flash";
const zhipuModel = process.env.ZHIPUAI_MODEL || "glm-4.7-flash";
const dashscopeModels = parseArrayEnv(process.env.DASHCOPE_MODELS);

function buildModelList(): ModelMeta[] {
  const list: ModelMeta[] = [];
  list.push({ id: "agnes", provider: "agnes", providerLabel: "Agnes AI", label: agnesModel });
  list.push({ id: "zhipu", provider: "zhipu", providerLabel: "智谱 AI", label: zhipuModel });
  for (const name of dashscopeModels) {
    list.push({ id: `dashscope-${name}`, provider: "dashscope", providerLabel: "百炼 DashScope", label: name });
  }
  return list;
}

function buildModelGroups(): ModelGroup[] {
  return [
    {
      provider: "agnes",
      providerLabel: "Agnes AI",
      models: [{ id: "agnes", label: agnesModel }],
    },
    {
      provider: "zhipu",
      providerLabel: "智谱 AI",
      models: [{ id: "zhipu", label: zhipuModel }],
    },
    {
      provider: "dashscope",
      providerLabel: "百炼 DashScope",
      models: dashscopeModels.map((name) => ({ id: `dashscope-${name}`, label: name })),
    },
  ];
}

export const modelList: ModelMeta[] = buildModelList();

export const modelGroups: ModelGroup[] = buildModelGroups();

const metaById: Record<string, ModelMeta> = {};
for (const m of modelList) {
  metaById[m.id] = m;
}

export function getProviderLabel(modelId: string): string {
  return metaById[modelId]?.providerLabel || "Agnes AI";
}

export function getModelLabel(modelId: string): string {
  return metaById[modelId]?.label || modelId;
}
