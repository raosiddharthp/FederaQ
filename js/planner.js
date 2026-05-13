const TEMPLATES = {
  "cross-system": {
    CRM:       { fields: ["deal_id","name","stage","risk_flag","amount","owner"], filters: { risk: true } },
    ERP:       { fields: ["sku_id","name","quantity","reorder_threshold","fulfilment_status"], filters: { open: true } },
    Ticketing: { fields: ["ticket_id","account","priority","sla_status","age"], filters: { priority: "P1" } }
  },
  inventory: {
    ERP: { fields: ["sku_id","name","quantity","reorder_threshold","fulfilment_status"], filters: {} }
  },
  pipeline: {
    CRM: { fields: ["deal_id","name","stage","amount","owner","close_date"], filters: {} }
  },
  "live-status": {
    Ticketing: { fields: ["ticket_id","account","priority","sla_status","age"], filters: {} }
  },
  "single-connector": {
    CRM:       { fields: ["*"], filters: {} },
    ERP:       { fields: ["*"], filters: {} },
    Ticketing: { fields: ["*"], filters: {} }
  }
};

export function planQueries(intent, connectors) {
  const template = TEMPLATES[intent] || TEMPLATES["cross-system"];
  return connectors.reduce((acc, c) => {
    acc[c] = template[c] || { fields: ["*"], filters: {} };
    return acc;
  }, {});
}
