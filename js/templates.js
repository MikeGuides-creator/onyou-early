// Embedded templates as a fallback if /templates fetch fails.
// We'll still prefer loading from /templates/*.json when served from a web server.

export const TEMPLATE_MANIFEST = [
  {
    id: "resume_modern_v1",
    title: "Resume — Modern",
    kind: "resume",
    category: "career",
    file: "templates/resume_modern_v1.json",
    access: { toolbox: true, vault: true, vaultSku: "onyou-resume-modern" },
    tags: ["resume", "career", "job seeker"]
  },
  {
    id: "nda_mutual_basic_v1",
    title: "NDA — Mutual (Basic)",
    kind: "document",
    category: "legal",
    file: "templates/nda_mutual_basic_v1.json",
    access: { toolbox: true, vault: true, vaultSku: "onyou-nda-mutual-basic" },
    tags: ["nda", "legal", "contract"]
  }
];

// Minimal embedded versions (kept small). Full versions also live in /templates.
export const EMBEDDED_TEMPLATES = {
  resume_modern_v1: {
    meta:{ id:"resume_modern_v1", title:"Resume — Modern", kind:"resume", category:"career", version:"1.0.0",
      access:{toolbox:true,vault:true,vaultSku:"onyou-resume-modern"}, tags:["resume","career"] },
    brand:{ allowLogo:true, allowAccent:true, defaults:{ accent:"#2563eb" } },
    model:{
      fields:[
        {id:"fullName", type:"text", label:"Full name", required:true},
        {id:"headline", type:"text", label:"Headline", required:false},
        {id:"email", type:"email", label:"Email", required:false},
        {id:"phone", type:"text", label:"Phone", required:false},
        {id:"location", type:"text", label:"Location", required:false},
        {id:"summary", type:"textarea", label:"Professional summary", required:false}
      ],
      collections:[
        { id:"work", label:"Work Experience", min:1, max:6,
          itemFields:[
            {id:"employer", type:"text", label:"Employer", required:true},
            {id:"title", type:"text", label:"Title", required:true},
            {id:"start", type:"text", label:"Start", required:false},
            {id:"end", type:"text", label:"End", required:false},
            {id:"highlights", type:"textarea", label:"Highlights", required:false}
          ]
        }
      ]
    },
    layout:{
      pages:[{
        id:"p1",
        blocks:[
          {type:"heading", text:"{{fullName}}"},
          {type:"paragraph", text:"{{headline}}"},
          {type:"kv", items:[
            {k:"Email", v:"{{email}}"},
            {k:"Phone", v:"{{phone}}"},
            {k:"Location", v:"{{location}}"}
          ]},
          {type:"headingSmall", text:"Summary"},
          {type:"paragraph", text:"{{summary}}"},
          {type:"headingSmall", text:"Work Experience"},
          {type:"collection", collectionId:"work"}
        ]
      }]
    },
    logic:{ rules:[] }
  },

  nda_mutual_basic_v1: {
    meta:{ id:"nda_mutual_basic_v1", title:"NDA — Mutual (Basic)", kind:"document", category:"legal", version:"1.0.0",
      access:{toolbox:true,vault:true,vaultSku:"onyou-nda-mutual-basic"}, tags:["nda","legal"] },
    brand:{ allowLogo:true, allowAccent:true, defaults:{ accent:"#2563eb" } },
    model:{
      fields:[
        {id:"disclosingParty", type:"text", label:"Disclosing party", required:true},
        {id:"receivingParty", type:"text", label:"Receiving party", required:true},
        {id:"effectiveDate", type:"date", label:"Effective date", required:false},
        {id:"termYears", type:"number", label:"Term (years)", required:false, defaultValue:2},
        {id:"governingLaw", type:"text", label:"Governing law (state/country)", required:false}
      ],
      collections:[]
    },
    layout:{
      pages:[{
        id:"p1",
        blocks:[
          {type:"heading", text:"Mutual Non-Disclosure Agreement"},
          {type:"paragraph", text:"This Agreement is entered into between {{disclosingParty}} and {{receivingParty}} effective {{effectiveDate}}."},
          {type:"headingSmall", text:"1. Purpose"},
          {type:"paragraph", text:"The parties wish to explore a potential business relationship and may exchange confidential information."},
          {type:"headingSmall", text:"2. Confidential Information"},
          {type:"paragraph", text:"Confidential Information includes non-public business, technical, financial, or customer information disclosed by either party."},
          {type:"headingSmall", text:"3. Obligations"},
          {type:"list", items:[
            "Use Confidential Information only for the Purpose.",
            "Protect it using reasonable care.",
            "Do not disclose it except to authorized representatives."
          ]},
          {type:"block", id:"termBlock", subtype:"paragraph", text:"This Agreement remains in effect for {{termYears}} years unless terminated earlier in writing."},
          {type:"paragraph", text:"Governing law: {{governingLaw}}."},
          {type:"signatureRow", items:[
            {label:"Disclosing Party Signature", value:"{{disclosingParty}}"},
            {label:"Receiving Party Signature", value:"{{receivingParty}}"}
          ]}
        ]
      }]
    },
    logic:{
      rules:[
        {
          id:"hideTermIfEmpty",
          when:{ field:"termYears", op:"isEmpty" },
          then:{ hideBlocks:["termBlock"] }
        }
      ]
    }
  }
};
