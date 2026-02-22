/**
 * Question-specific response analysis: what the user should have said or discussed
 * for each exact question (behavioral or technical).
 */

export interface ResponseAnalysisSection {
  title: string;
  items: string[];
}

const q = (s: string) => s.toLowerCase();

/** Returns response-analysis sections tailored to the exact question text. */
export function getResponseAnalysisForQuestion(
  questionText: string,
  isTechnical: boolean
): ResponseAnalysisSection[] {
  const qq = q(questionText);

  if (isTechnical) {
    // Technical: tailor by problem type if detectable
    if (qq.includes("two sum") || qq.includes("array") && qq.includes("target")) {
      return [
        {
          title: "For this problem (Two Sum), you should have:",
          items: [
            "Restated the problem: find two indices whose values sum to target.",
            "Stated your approach (e.g. hash map for O(n) time) before coding.",
            "Mentioned time and space complexity (e.g. O(n) time, O(n) space).",
            "Noted edge cases: empty array, no solution (if applicable), duplicates.",
            "Walked through a small example after writing the code.",
          ],
        },
        {
          title: "Structure",
          items: [
            "Start: Restate the problem and confirm inputs/outputs.",
            "Before coding: One-sentence outline of your approach.",
            "While coding: Briefly say what each part does.",
            "After coding: Walk through an example or how you’d test.",
          ],
        },
      ];
    }
    // Generic technical
    return [
      {
        title: "Response structure notes",
        items: [
          "Start: Restate the problem and confirm inputs/outputs in your own words.",
          "Before coding: Give a one-sentence outline of your approach.",
          "While coding: Briefly say what each part does.",
          "After coding: Walk through a small example or say how you’d test or verify.",
          "If stuck: Say what you’re considering aloud instead of staying silent.",
        ],
      },
    ];
  }

  // Behavioral: match question themes and return tailored guidance
  const sections: ResponseAnalysisSection[] = [];

  if (/\b(conflict|disagre(e|ed)|disagreement|disagree(d)?)\b/.test(qq)) {
    sections.push({
      title: "For a conflict or disagreement question, focus on:",
      items: [
        "Situation: When and where the disagreement happened; who was involved.",
        "Your approach: How you listened, asked questions, or found common ground.",
        "What you did: Specific steps (e.g. one-on-one conversation, data you brought).",
        "Result: How it was resolved and what the relationship or outcome was afterward.",
        "Avoid: Blame or making the other person wrong; keep it neutral and professional.",
      ],
    });
  } else if (/\b(failure|mistake|went wrong|underperformed|lost|proven wrong|error)\b/.test(qq)) {
    sections.push({
      title: "For a failure or mistake question, focus on:",
      items: [
        "Situation: Brief context—what you were responsible for and what went wrong.",
        "Ownership: What you did or didn’t do; avoid deflecting to others.",
        "What you learned: Concrete takeaway (e.g. “I now always X”).",
        "What you’d do differently: One or two specific changes.",
        "Result: How you applied the lesson later (another project, process change).",
      ],
    });
  } else if (/\b(lead|led|mentor(ed)?|ownership|improved.*team|advocat(e|ed))\b/.test(qq)) {
    sections.push({
      title: "For a leadership or influence question, focus on:",
      items: [
        "Situation: The goal or gap (e.g. team needed X, no one owned Y).",
        "Your role: What you decided to own or how you stepped up.",
        "Action: Specific things you did (decisions, conversations, process changes).",
        "Impact on others: How teammates or the team’s output changed.",
        "Result: Outcome or metric (e.g. “shipped on time”, “adopted by 3 teams”).",
      ],
    });
  } else if (/\b(team|collaborat(e|ed)|cross-functional|align(ed)?|multiple teams)\b/.test(qq)) {
    sections.push({
      title: "For a teamwork or collaboration question, focus on:",
      items: [
        "Situation: Who was involved, what the shared goal or constraint was.",
        "Your contribution: What you did (not just “we”—your specific actions).",
        "How you worked with others: Communication, meetings, async updates, tradeoffs.",
        "Challenges: Misalignment, conflicting priorities, or disagreement and how you handled it.",
        "Result: What was delivered or achieved as a team.",
      ],
    });
  } else if (/\b(prioritiz(e|ed)|say no|tradeoff|balance|ruthlessly)\b/.test(qq)) {
    sections.push({
      title: "For a prioritization or tradeoff question, focus on:",
      items: [
        "Situation: What was competing (e.g. scope vs. deadline, two projects).",
        "Criteria: How you decided (impact, urgency, stakeholder, data).",
        "What you did: What you said no to or deprioritized, and how you communicated it.",
        "Result: Outcome of the decision (shipped on time, avoided scope creep, etc.).",
        "What you’d do the same or differently with the same constraints.",
      ],
    });
  } else if (/\b(learn(ed)?|learn quickly|new technology|new stack)\b/.test(qq)) {
    sections.push({
      title: "For a learning question, focus on:",
      items: [
        "Situation: What you needed to learn and why (project, gap, deadline).",
        "How you learned: Resources, practice, or people (e.g. docs, side project, teammate).",
        "Action: How you applied it (built X, shipped Y, improved Z).",
        "Result: Deliverable or outcome (e.g. “shipped in 3 weeks”, “team adopted it”).",
        "What you’d do differently or what you’d learn next.",
      ],
    });
  } else if (/\b(feedback|harsh|criticism|disagree.*design|defend)\b/.test(qq)) {
    sections.push({
      title: "For feedback or defending a decision, focus on:",
      items: [
        "Situation: What the feedback was or what was being challenged.",
        "Your initial reaction: How you listened and stayed open (not defensive).",
        "What you did: How you incorporated feedback, pushed back with reasoning, or compromised.",
        "Result: What changed (design, process, relationship) and what you learned.",
        "Tie back to the role: How you’d handle similar situations in this job.",
      ],
    });
  } else if (/\b(debug|production|complex issue|under pressure)\b/.test(qq)) {
    sections.push({
      title: "For a technical or high-pressure problem, focus on:",
      items: [
        "Situation: What broke, when, and what was at stake (users, revenue, SLA).",
        "Your approach: How you triaged (logs, metrics, repro steps).",
        "Action: Steps you took, how you communicated, and any tradeoffs (e.g. rollback vs. fix).",
        "Result: How it was resolved and any follow-up (post-mortem, monitoring).",
        "What you learned or would do differently next time.",
      ],
    });
  } else if (/\b(customer|stakeholder|say no|request|communicat(e|ed))\b/.test(qq)) {
    sections.push({
      title: "For a customer or stakeholder question, focus on:",
      items: [
        "Situation: Who asked for what and why it was difficult (scope, timeline, say no).",
        "What you did: How you listened, explained, or negotiated.",
        "How you communicated: Clarity, empathy, and setting expectations.",
        "Result: Outcome (e.g. request adjusted, relationship preserved, alternative offered).",
        "What you’d do the same or differently.",
      ],
    });
  }

  // Always add a short STAR + specifics reminder if we had a theme
  const starSection: ResponseAnalysisSection = {
    title: "For any behavioral answer, also include:",
    items: [
      "STAR: Situation (when/where/who), Task (your goal), Action (what you did), Result (outcome and learning).",
      "Concrete details: numbers, timeframes, or names (e.g. “over 3 months”, “with the design team”).",
      "How it relates to this role or the question asked.",
    ],
  };

  if (sections.length > 0) {
    sections.push(starSection);
    return sections;
  }

  // Generic behavioral
  return [
    {
      title: "What you should have said and discussed",
      items: [
        "Situation: Set the scene—when, where, who was involved, and why it mattered.",
        "Task: Your specific responsibility or goal.",
        "Action: What you did—steps, decisions, how you worked with others. Focus on your contribution.",
        "Result: The outcome, impact, or metrics, and what you or the team learned.",
        "Concrete details: numbers, timeframes, or names where possible.",
        "How the story relates to the role or the question asked.",
      ],
    },
  ];
}
