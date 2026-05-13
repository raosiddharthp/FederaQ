let mutationCycle = 0;

const state = {
  CRM: {
    deals: [
      { deal_id:"D-001", name:"Acme Corp",  stage:"Negotiation", risk_flag:true,  amount:280000, owner:"J.Torres", close_date:"2026-06-30" },
      { deal_id:"D-002", name:"Bravo Inc",  stage:"Proposal",    risk_flag:true,  amount:95000,  owner:"R.Kim",    close_date:"2026-07-15" },
      { deal_id:"D-003", name:"Delta LLC",  stage:"Closed Won",  risk_flag:false, amount:410000, owner:"S.Patel",  close_date:"2026-05-01" },
      { deal_id:"D-004", name:"Echo SA",    stage:"Negotiation", risk_flag:true,  amount:175000, owner:"M.Chen",   close_date:"2026-06-20" }
    ]
  },
  ERP: {
    skus: [
      { sku_id:"SKU-A10", name:"Enterprise License",    quantity:12, reorder_threshold:15, fulfilment_status:"Delayed"  },
      { sku_id:"SKU-B22", name:"Professional Services", quantity:8,  reorder_threshold:10, fulfilment_status:"On Track" },
      { sku_id:"SKU-C05", name:"Support Contract",      quantity:3,  reorder_threshold:5,  fulfilment_status:"At Risk"  },
      { sku_id:"SKU-D18", name:"Implementation Pack",   quantity:20, reorder_threshold:8,  fulfilment_status:"On Track" }
    ]
  },
  Ticketing: {
    tickets: [
      { ticket_id:"TICK-1091", account:"Acme Corp", priority:"P1", sla_status:"Breached", age:"4h" },
      { ticket_id:"TICK-1104", account:"Bravo Inc", priority:"P1", sla_status:"At Risk",  age:"2h" },
      { ticket_id:"TICK-1087", account:"Echo SA",   priority:"P2", sla_status:"OK",       age:"1h" },
      { ticket_id:"TICK-1112", account:"Delta LLC", priority:"P1", sla_status:"OK",       age:"30m" }
    ]
  }
};

function mutate() {
  mutationCycle++;
  state.ERP.skus = state.ERP.skus.map(s => ({
    ...s,
    quantity: Math.max(0, s.quantity - (mutationCycle % 3)),
    fulfilment_status: s.quantity <= s.reorder_threshold ? "At Risk" : s.fulfilment_status
  }));
  if (mutationCycle % 4 === 0) {
    state.CRM.deals = state.CRM.deals.map(d => ({ ...d, risk_flag: !d.risk_flag }));
  }
  state.Ticketing.tickets = state.Ticketing.tickets.map(t => ({
    ...t,
    sla_status: mutationCycle % 5 === 0 && t.priority === "P1" ? "Breached" : t.sla_status
  }));
}

setInterval(mutate, 15000);

export function queryConnector(name, plan) {
  return {
    data: structuredClone(state[name]),
    source: name,
    fetched_at: Date.now(),
    ttl_policy: name === "ERP" ? 60 : name === "Ticketing" ? 90 : 300
  };
}
