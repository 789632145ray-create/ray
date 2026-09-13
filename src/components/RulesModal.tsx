type Props = {
  onClose: () => void;
};

export function RulesModal({ onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="rules-box" onClick={(event) => event.stopPropagation()}>
        <h2>怎麼玩越南賽馬</h2>
        <p className="muted">Cờ Cá Ngựa，四人各帶四匹馬，先把馬送進自家馬槽的人獲勝。</p>
        <ol>
          <li>擲到 <b>1 或 6</b> 才能把馬從馬廄開出去，停在自己的出發星上。</li>
          <li>擲到 1 或 6 可以再擲一次，同一回合最多三次。</li>
          <li>走到對手的格子就把它<b>踢回馬廄</b>，對方必須重新出發。</li>
          <li>自己的馬不能重疊。馬槽裡也不能越過或停在己方的馬上面。</li>
          <li>跑完一圈後進入 1–6 號馬槽，點數必須剛好。</li>
          <li>先把馬佔滿 <b>3、4、5、6</b> 號槽的人獲勝。</li>
        </ol>
        <button className="btn" onClick={onClose}>
          知道了，開賽
        </button>
      </div>
    </div>
  );
}
