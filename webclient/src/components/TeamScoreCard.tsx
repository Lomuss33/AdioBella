interface TeamScoreCardProps {
  caption: string;
  matchScore: number;
  gamePoints: number;
  className?: string;
}

function TeamScoreCard({ caption, matchScore, gamePoints, className }: TeamScoreCardProps) {
  return (
    <div className={`team-score-card ${className ?? ""}`.trim()}>
      <span className="score-label">{caption}</span>
      <strong>{matchScore}</strong>
      <small>{gamePoints} game</small>
    </div>
  );
}

export default TeamScoreCard;
