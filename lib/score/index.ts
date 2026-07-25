export {
  CLAIM_BASE,
  DECISIVE_LEADER_SHARE,
  EDGE_CREDIT,
  EDGE_REBUTTAL_BONUS,
  PENALTY_FALLACY_CAP,
  PENALTY_NEEDS_EVIDENCE_NO_SUPPORT,
  PENALTY_PER_FALLACY,
  PENALTY_UNSUPPORTED,
  UNDERCUT_PENALTY,
} from "@/lib/score/constants";

export {
  claimPenalties,
  computeDebateScore,
  normalizeSpeakerScores,
  scoreClaim,
  toDebateScorePayload,
  type ClaimScoreBreakdown,
  type DebateScoreBreakdown,
  type DebateScoreResult,
  type EdgeScoreBreakdown,
  type ScoreLeader,
} from "@/lib/score/debateScore";
