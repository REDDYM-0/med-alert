import {
  Activity, AlertTriangle, Ambulance, Baby, Flame, HeartHandshake, HeartPulse, Shield, ShieldAlert, Wind, Zap, Droplets,
} from "lucide-react";

export const TIRUPATI_EMERGENCY_CONTACTS = [
  {
    id: "ambulance",
    name: "Ambulance / Medical Emergency",
    number: "108",
    description: "Call for an ambulance or urgent medical assistance.",
    icon: Ambulance,
    primary: true,
  },
  {
    id: "police",
    name: "Police",
    number: "100",
    description: "Contact police for immediate safety or law enforcement help.",
    icon: Shield,
  },
  {
    id: "fire",
    name: "Fire",
    number: "101",
    description: "Report a fire or request fire and rescue services.",
    icon: Flame,
  },
  {
    id: "child-helpline",
    name: "Child Helpline",
    number: "1098",
    description: "Get help for a child in need of care or protection.",
    icon: Baby,
  },
  {
    id: "women-helpline",
    name: "Women Helpline",
    number: "1091",
    description: "Reach support for women facing an emergency.",
    icon: HeartHandshake,
  },
];

export const EMPTY_PROFILE = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  allergies: "",
  conditions: "",
  medications: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  doctorName: "",
  doctorPhone: "",
  notes: "",
};

export const DEMO_PROFILE = {
  fullName: "Alex Morgan",
  dateOfBirth: "1992-06-14",
  gender: "",
  bloodGroup: "O+",
  allergies: "Penicillin",
  conditions: "Asthma",
  medications: "Rescue inhaler",
  emergencyContactName: "Jamie Morgan",
  emergencyContactPhone: "555-010-2020",
  emergencyContactRelationship: "",
  doctorName: "Dr. Taylor Reed",
  doctorPhone: "555-010-4040",
  notes: "Demo profile — replace with your own verified information.",
};

export const GUIDES = [
  {
    id: "chest-pain", title: "Chest pain", short: "Recognize warning signs and act quickly.",
    icon: HeartPulse, tint: "rose",
    immediate: ["Call your local emergency services now, especially for pressure, tightness, or pain with breathlessness.", "Help the person rest in a comfortable position and stay with them.", "Note when symptoms began and share any known medicines or conditions with responders."],
    avoid: ["Do not drive them yourself if emergency services are available.", "Do not give food or drink, or delay the call to see if symptoms pass.", "Do not give medication unless a medical professional or dispatcher directs you."],
    call: "Call immediately for new, severe, persistent, or recurring chest pain, or any pain with shortness of breath, sweating, nausea, or faintness.",
  },
  {
    id: "bleeding", title: "Severe bleeding", short: "Apply firm pressure while help is on the way.",
    icon: Droplets, tint: "red",
    immediate: ["Call emergency services for severe bleeding.", "Press firmly on the wound with clean cloth or gauze; keep pressure steady.", "If blood soaks through, add more material without lifting the first layer."],
    avoid: ["Do not remove an embedded object; press around it.", "Do not repeatedly lift the cloth to check the wound.", "Do not apply a tourniquet unless trained or directed by emergency dispatch."],
    call: "Call immediately for heavy, spurting, uncontrolled bleeding or signs of shock such as pale, clammy skin or confusion.",
  },
  {
    id: "choking", title: "Choking", short: "Act if they cannot breathe, speak, or cough.",
    icon: Wind, tint: "blue",
    immediate: ["If the person cannot breathe, speak, or cough effectively, call emergency services or ask someone to call.", "Follow the dispatcher's instructions for age-appropriate choking first aid.", "If they become unresponsive, carefully lower them and begin CPR if trained."],
    avoid: ["Do not perform blind finger sweeps in the mouth.", "Do not give water or food while choking.", "Do not leave the person alone."],
    call: "Call immediately if the person cannot breathe or speak, turns blue, becomes unresponsive, or the blockage does not clear.",
  },
  {
    id: "burns", title: "Burns", short: "Cool the burn and protect the skin.",
    icon: Flame, tint: "amber",
    immediate: ["Move away from the heat source if safe.", "Cool the burn under cool running water for 20 minutes; remove nearby jewelry or loose clothing.", "Cover loosely with a clean, non-fluffy dressing and seek medical advice."],
    avoid: ["Do not use ice, butter, creams, or adhesive dressings.", "Do not pull away clothing stuck to the skin or break blisters.", "Do not delay help for large, deep, chemical, or electrical burns."],
    call: "Call emergency services for severe or extensive burns, breathing difficulty, burns to the face or airway, or electrical/chemical injuries.",
  },
  {
    id: "unconsciousness", title: "Unconsciousness", short: "Check responsiveness and breathing.",
    icon: AlertTriangle, tint: "violet",
    immediate: ["Call emergency services and check whether the person responds and is breathing normally.", "If they are not breathing normally, begin CPR if trained and follow dispatcher guidance.", "If breathing normally and no serious injury is suspected, place them on their side and monitor."],
    avoid: ["Do not give anything to eat or drink.", "Do not leave them alone or assume they are asleep.", "Do not move them if a head, neck, or back injury is possible unless there is immediate danger."],
    call: "Call immediately for any unexplained loss of consciousness, abnormal breathing, injury, or failure to wake promptly.",
  },
  {
    id: "seizure", title: "Seizure", short: "Protect from injury and time the seizure.",
    icon: Zap, tint: "purple",
    immediate: ["Time the seizure and move nearby hazards away.", "Cushion the head, loosen tight clothing around the neck, and stay with the person.", "When movements stop, check breathing and place them on their side if safe."],
    avoid: ["Do not restrain them or put anything in their mouth.", "Do not give food, drink, or medication until fully alert.", "Do not try to stop the movements."],
    call: "Call if it is their first seizure, lasts 5 minutes or longer, repeats without recovery, causes injury, or breathing/recovery is difficult.",
  },
  {
    id: "allergic-reaction", title: "Severe allergic reaction", short: "Treat breathing or swelling symptoms as urgent.",
    icon: ShieldAlert, tint: "orange",
    immediate: ["Call emergency services immediately for breathing difficulty, throat/tongue swelling, collapse, or rapidly worsening symptoms.", "If they have their own prescribed epinephrine auto-injector, help them use it as directed.", "Keep them still and monitor breathing; follow dispatcher instructions."],
    avoid: ["Do not wait to see whether severe symptoms improve.", "Do not make them stand or walk.", "Do not give another person's medication."],
    call: "Call immediately for suspected anaphylaxis, breathing trouble, throat/tongue swelling, faintness, or rapidly spreading symptoms.",
  },
  {
    id: "stroke", title: "Stroke warning signs", short: "Remember face, arm, speech, time.",
    icon: Activity, tint: "teal",
    immediate: ["Call emergency services immediately; note the time symptoms started or when they were last well.", "Check for face drooping, arm weakness, or speech difficulty.", "Stay with them and keep them comfortable while waiting for responders."],
    avoid: ["Do not wait for symptoms to improve or drive if emergency services are available.", "Do not give food, drink, or medication.", "Do not let them sleep it off."],
    call: "Call immediately for any sudden face droop, weakness/numbness, speech, vision, balance, or severe headache symptoms.",
  },
];

export const QUICK_CARDS = [
  { title: "Chest pain", description: "Pressure, tightness, or sudden discomfort.", guideId: "chest-pain", icon: HeartPulse },
  { title: "Severe bleeding", description: "Uncontrolled bleeding needs fast action.", guideId: "bleeding", icon: Droplets },
  { title: "Choking", description: "When someone cannot breathe or speak.", guideId: "choking", icon: Wind },
  { title: "Stroke signs", description: "Sudden face, arm, or speech changes.", guideId: "stroke", icon: Activity },
];
