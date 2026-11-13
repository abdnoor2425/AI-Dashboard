import type React from "react";
import Overview from "./overview";
import Attention from "./attention";
import Website from "./website";
import Social from "./social";
import Reels from "./reels";
import Goals from "./goals";
import Metrics from "./metrics";
import Decisions from "./decisions";
import Clients from "./clients";
import Team from "./team";
import { Inbox, Calendar, Files, Outputs, Skills, Suggestions, Usage } from "./more";
import Connections from "./connections";
import Setup from "./setup";
import Settings from "./settings";

export const VIEWS: Record<string, React.ComponentType> = {
  overview: Overview, attention: Attention, website: Website, social: Social, reels: Reels, goals: Goals, metrics: Metrics,
  decisions: Decisions, clients: Clients, team: Team, inbox: Inbox, calendar: Calendar, files: Files, outputs: Outputs, skills: Skills,
  suggestions: Suggestions, usage: Usage, connections: Connections, setup: Setup, settings: Settings,
};
