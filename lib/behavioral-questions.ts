import type { JobFunction } from "./livedata-types";

/**
 * Templates that weave in {company} and {role} for tailored questions.
 * Each function has 5+ templates; we pick 5 so questions feel specific to the role and company.
 */
const TAILORED_TEMPLATES: Record<JobFunction, string[]> = {
  engineering: [
    "In a {role} role at {company}, how you handle production issues matters. Tell me about a time you had to debug a complex issue under pressure. What was your approach and outcome?",
    "At {company}, {role}s often have to advocate for technical decisions. Describe a situation where you disagreed with a technical direction. How did you handle it?",
    "As a {role} at {company}, you may need to learn quickly. Give an example of when you had to learn a new technology or stack to deliver a project.",
    "Tell me about a time you mentored a teammate or improved your team's engineering practices. How does that experience prepare you for {company}?",
    "At {company}, {role}s balance speed and quality. Describe a project where you had to make that tradeoff. How did you decide?",
  ],
  product: [
    "As a {role} at {company}, you'll make calls with incomplete data. Tell me about a product decision you made without full information. How did you proceed?",
    "At {company}, {role}s often have to say no. Describe a time you had to say no to a stakeholder or customer request. How did you communicate it?",
    "Tell me about a time you had to prioritize ruthlessly with competing deadlines. How would that help you in the {role} role at {company}?",
    "At {company}, user feedback drives product. Tell me about a time you used user feedback to change a product direction.",
    "Describe a situation where you had to align multiple teams around a single product vision. How does that relate to how {company} works?",
  ],
  design: [
    "As a {role} at {company}, you'll need to defend design decisions. Tell me about a time you had to defend a design to stakeholders who disagreed.",
    "Describe a project where you had to simplify a complex user flow. What was your process? How would you apply that at {company}?",
    "At {company}, {role}s balance user needs and business constraints. Give an example of when you had to do that.",
    "Tell me about a time you received harsh design feedback. How did you respond? How would you handle that at {company}?",
    "Describe when you had to make a design decision with limited user research. Why would that matter for the {role} role at {company}?",
  ],
  sales: [
    "Tell me about a deal you lost. What did you learn and how did you apply it? How would that inform how you sell at {company}?",
    "At {company}, {role}s build trust with prospects. Describe a time you had to build trust with a difficult or skeptical prospect.",
    "Give an example of when you had to work with product or engineering to close a deal. How does that align with {company}'s motion?",
    "Tell me about a time you had to negotiate with a customer on price or terms. How would you approach that at {company}?",
    "Describe a situation where you had to recover a relationship with an unhappy customer. Why is that relevant for the {role} role at {company}?",
  ],
  marketing: [
    "Tell me about a campaign that underperformed. What did you do next? How would you apply that at {company}?",
    "At {company}, {role}s prove ROI. Describe a time you had to prove marketing ROI with limited data.",
    "Give an example of when you had to align marketing with a product launch that kept changing. How does that relate to {company}?",
    "Tell me about a time you had to convince leadership to try a new channel or tactic. Why would that matter for the {role} role at {company}?",
    "Describe when you had to prioritize one audience or segment over another. How would you do that at {company}?",
  ],
  operations: [
    "At {company}, {role}s improve processes. Tell me about a process you improved that had resistance from the team.",
    "Describe a time you had to make a decision with incomplete information in a crisis. How would you handle that at {company}?",
    "Give an example of when you had to balance cost efficiency with quality or speed. Why is that relevant for the {role} role at {company}?",
    "Tell me about a time you had to coordinate across many teams to hit a deadline. How does that compare to how {company} operates?",
    "Describe a situation where you had to implement a change that was unpopular. How would you approach that at {company}?",
  ],
  finance: [
    "As a {role} at {company}, you may present tough news. Tell me about a time you had to present difficult financial news to leadership.",
    "Describe a situation where you found a significant error or risk. How did you handle it? How would you do that at {company}?",
    "Give an example of when you had to make a recommendation with ambiguous data. Why would that matter for the {role} role at {company}?",
    "Tell me about a time you had to push back on a spending or investment request. How does that relate to {company}'s culture?",
    "Describe when you had to explain a complex financial concept to a non-finance audience. How would you do that at {company}?",
  ],
  data_science: [
    "As a {role} at {company}, your analysis drives decisions. Tell me about a time your analysis led to a decision that was later proven wrong. What did you learn?",
    "Describe a project where you had to explain a complex model to non-technical stakeholders. How would you do that at {company}?",
    "At {company}, {role}s balance accuracy and interpretability. Give an example of when you had to balance model accuracy with interpretability or speed.",
    "Tell me about a time you had to work with messy or incomplete data to deliver insights. Why is that relevant for the {role} role at {company}?",
    "Describe a situation where you had to prioritize which analyses to do first with limited time. How would you approach that at {company}?",
  ],
  customer_success: [
    "At {company}, {role}s save at-risk customers. Tell me about a time you had to save a customer who was at risk of churning.",
    "Describe when you had to say no to a customer request. How did you handle it? How would you do that at {company}?",
    "Give an example of when you had to escalate an issue and how you managed the relationship. Why would that matter for the {role} role at {company}?",
    "Tell me about a time you turned customer feedback into product or process change. How does that align with {company}'s approach?",
    "Describe a situation where you had to balance many customers with limited time. How would you prioritize at {company}?",
  ],
};

/**
 * Returns questions tailored to company and role. Uses templates that weave in
 * company and role names so questions feel specific, not generic.
 */
export function getQuestionsForInterview(
  company: string,
  role: string,
  fn: JobFunction
): string[] {
  const safeCompany = (company || "the company").trim();
  const safeRole = (role || "this role").trim();
  const templates = TAILORED_TEMPLATES[fn] ?? TAILORED_TEMPLATES.engineering;
  return templates.slice(0, 5).map((t) =>
    t.replace(/\{company\}/g, safeCompany).replace(/\{role\}/g, safeRole)
  );
}

/**
 * Behavioral questions by job function (aligned with common next-step roles from LiveDataTechnologies).
 */
export const BEHAVIORAL_QUESTIONS: Record<JobFunction, string[]> = {
  engineering: [
    "Tell me about a time you had to debug a complex production issue under pressure. What was your approach and outcome?",
    "Describe a situation where you disagreed with a technical decision. How did you handle it?",
    "Give an example of when you had to learn a new technology quickly to deliver a project.",
    "Tell me about a time you mentored a teammate or improved your team's engineering practices.",
    "Describe a project where you had to balance speed of delivery with code quality. How did you decide?",
  ],
  product: [
    "Tell me about a product decision you made with incomplete data. How did you proceed?",
    "Describe a time you had to say no to a stakeholder or customer request. How did you communicate it?",
    "Give an example of when you had to prioritize ruthlessly with competing deadlines.",
    "Tell me about a time you used user feedback to change a product direction.",
    "Describe a situation where you had to align multiple teams around a single product vision.",
  ],
  design: [
    "Tell me about a time you had to defend a design decision to stakeholders who disagreed.",
    "Describe a project where you had to simplify a complex user flow. What was your process?",
    "Give an example of when you had to balance user needs with business constraints.",
    "Tell me about a time you received harsh design feedback. How did you respond?",
    "Describe when you had to make a design decision with limited user research.",
  ],
  sales: [
    "Tell me about a deal you lost. What did you learn and how did you apply it?",
    "Describe a time you had to build trust with a difficult or skeptical prospect.",
    "Give an example of when you had to work with product or engineering to close a deal.",
    "Tell me about a time you had to negotiate with a customer on price or terms.",
    "Describe a situation where you had to recover a relationship with an unhappy customer.",
  ],
  marketing: [
    "Tell me about a campaign that underperformed. What did you do next?",
    "Describe a time you had to prove marketing ROI with limited data.",
    "Give an example of when you had to align marketing with a product launch that kept changing.",
    "Tell me about a time you had to convince leadership to try a new channel or tactic.",
    "Describe when you had to prioritize one audience or segment over another.",
  ],
  operations: [
    "Tell me about a process you improved that had resistance from the team.",
    "Describe a time you had to make a decision with incomplete information in a crisis.",
    "Give an example of when you had to balance cost efficiency with quality or speed.",
    "Tell me about a time you had to coordinate across many teams to hit a deadline.",
    "Describe a situation where you had to implement a change that was unpopular.",
  ],
  finance: [
    "Tell me about a time you had to present difficult financial news to leadership.",
    "Describe a situation where you found a significant error or risk. How did you handle it?",
    "Give an example of when you had to make a recommendation with ambiguous data.",
    "Tell me about a time you had to push back on a spending or investment request.",
    "Describe when you had to explain a complex financial concept to a non-finance audience.",
  ],
  data_science: [
    "Tell me about a time your analysis led to a decision that was later proven wrong. What did you learn?",
    "Describe a project where you had to explain a complex model to non-technical stakeholders.",
    "Give an example of when you had to balance model accuracy with interpretability or speed.",
    "Tell me about a time you had to work with messy or incomplete data to deliver insights.",
    "Describe a situation where you had to prioritize which analyses to do first with limited time.",
  ],
  customer_success: [
    "Tell me about a time you had to save a customer who was at risk of churning.",
    "Describe when you had to say no to a customer request. How did you handle it?",
    "Give an example of when you had to escalate an issue and how you managed the relationship.",
    "Tell me about a time you turned customer feedback into product or process change.",
    "Describe a situation where you had to balance many customers with limited time.",
  ],
};

export function getQuestionsForFunction(fn: JobFunction): string[] {
  return BEHAVIORAL_QUESTIONS[fn] ?? BEHAVIORAL_QUESTIONS.engineering;
}
