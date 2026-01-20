const EXAM = {
  title: "CLS Practice Exam",
  course: "Combat Lifesaver (CLS)",
  mode: "Practice", // or "Exam"
  timeLimitSeconds: 25 * 60, // set null for untimed
  questions: [
    {
      id: "q1",
      type: "single",
      points: 1,
      prompt: "Which of the following is the correct first step in MARCH?",
      hint: "MARCH is used to prioritize life-threatening injuries.",
      options: [
        "Respiration",
        "Massive hemorrhage",
        "Circulation",
        "Hypothermia / Head injury"
      ],
      answer: [1], // index of correct option
      note: "MARCH: Massive hemorrhage, Airway, Respiration, Circulation, Hypothermia/Head injury."
    },
    {
      id: "q2",
      type: "multi",
      points: 2,
      prompt: "Select ALL that apply: Which are signs of shock?",
      hint: "Pick every correct sign.",
      options: [
        "Cool, clammy skin",
        "Altered mental status",
        "Strong radial pulse",
        "Rapid breathing",
        "Delayed capillary refill"
      ],
      answer: [0,1,3,4],
      note: "Shock indicators often include poor perfusion and mental status changes."
    },
    {
      id: "q3",
      type: "true_false",
      points: 1,
      prompt: "A tourniquet should be loosened periodically once applied.",
      hint: "Consider standard CLS/TCCC guidance.",
      answer: false,
      note: "Once applied, a tourniquet is NOT loosened unless directed by protocol."
    },
    {
      id: "q4",
      type: "multi_not",
      points: 2,
      prompt: "Select ALL that do NOT apply: Which are NOT appropriate tourniquet placement guidelines?",
      hint: "This is a negative-selection question.",
      options: [
        "Place 2–3 inches above the wound (not over a joint)",
        "Place directly over the knee or elbow joint",
        "Tighten until bleeding stops and distal pulse is absent",
        "Loosen periodically to allow blood flow",
        "Record the time of application"
      ],
      // For multi_not: answer holds the indices that are "NOT appropriate" (the ones you should select)
      answer: [1,3],
      note: "Tourniquets are not loosened once applied in tactical care unless directed by protocol/medical authority."
    },
    {
      id: "q5",
      type: "match",
      points: 3,
      prompt: "Drag the correct TERM into each definition.",
      hint: "Match items on the left to the definitions on the right.",
      // terms are draggable items
      terms: [
        { key: "TQ", label: "Tourniquet" },
        { key: "NPA", label: "NPA (Nasopharyngeal Airway)" },
        { key: "OC", label: "Occlusive Dressing" },
        { key: "NP", label: "Needle Decompression" }
      ],
      // each definition expects a key
      definitions: [
        { id: "d1", text: "Used to control life-threatening extremity bleeding.", expect: "TQ" },
        { id: "d2", text: "Used to help maintain an airway when appropriate.", expect: "NPA" },
        { id: "d3", text: "Seals an open chest wound to prevent air entry.", expect: "OC" },
        { id: "d4", text: "Emergency treatment for tension pneumothorax (when indicated).", expect: "NP" }
      ],
      note: "This is a simple matching demo; you’ll replace with real CLS content later."
    },
    {
      id: "q6",
      type: "order",
      points: 3,
      prompt: "Put these steps in the correct order for applying a pressure dressing (demo).",
      hint: "Drag to reorder from first → last.",
      steps: [
        { key: "s1", label: "Secure dressing to maintain pressure" },
        { key: "s2", label: "Expose wound and locate bleeding source" },
        { key: "s3", label: "Apply direct pressure with sterile dressing" },
        { key: "s4", label: "Reassess for continued bleeding" }
      ],
      // answer is the correct sequence of keys
      answer: ["s2","s3","s1","s4"],
      note: "Exact steps can vary by TCCC/CLS guidance; this is placeholder data."
    }
  ]
};
