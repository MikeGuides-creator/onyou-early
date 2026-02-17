// v1: stub. We'll wire this to a Netlify function later.
// Expected: return a TEMPLATE JSON object matching our schema.

export async function generateTemplateWithAI(prompt){
  // Placeholder: you can swap this to call /api/onyou-generate
  // return await fetch("/api/onyou-generate", { method:"POST", headers:{...}, body:JSON.stringify({prompt}) }).then(r=>r.json());

  // For now, return a simple “Custom Intake Form” template so the button works.
  return {
    meta:{
      id:"custom_intake_ai_v1",
      title:"Client Intake Form — AI Generated",
      kind:"form",
      category:"operations",
      version:"1.0.0",
      access:{ toolbox:true, vault:true, vaultSku:"onyou-client-intake-ai" },
      tags:["intake","client","operations"]
    },
    brand:{ allowLogo:true, allowAccent:true, defaults:{ accent:"#2563eb" } },
    model:{
      fields:[
        {id:"clientName", type:"text", label:"Client name", required:true, group:"Client"},
        {id:"clientEmail", type:"email", label:"Client email", required:false, group:"Client"},
        {id:"projectType", type:"text", label:"Project type", required:false, group:"Project"},
        {id:"budget", type:"number", label:"Estimated budget", required:false, group:"Project"},
        {id:"timeline", type:"text", label:"Desired timeline", required:false, group:"Project"},
        {id:"notes", type:"textarea", label:"Notes", required:false, group:"Notes"}
      ],
      collections:[]
    },
    layout:{
      pages:[{
        id:"p1",
        blocks:[
          {type:"heading", text:"Client Intake Form"},
          {type:"paragraph", text:"Client: {{clientName}}"},
          {type:"kv", items:[
            {k:"Email", v:"{{clientEmail}}"},
            {k:"Project", v:"{{projectType}}"},
            {k:"Budget", v:"{{budget}}"},
            {k:"Timeline", v:"{{timeline}}"}
          ]},
          {type:"headingSmall", text:"Notes"},
          {type:"paragraph", text:"{{notes}}"},
          {type:"signatureRow", items:[
            {label:"Client signature", value:"{{clientName}}"},
            {label:"Date", value:""}
          ]}
        ]
      }]
    },
    logic:{ rules:[] }
  };
}
