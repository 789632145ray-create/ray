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
          <li>每次擲 <b>兩顆骰子</b>。兩顆點數分開走，可以走同一匹或兩匹馬。</li>
          <li>擲到 <b>6</b> 才能把馬從馬廄開出去，停在自己顏色旁邊最外側的出發格。</li>
          <li>擲到 6 或對子可以再擲一輪，同一回合最多三輪。</li>
          <li>前方有馬就不能跳過去。要踢對手，必須<b>骰到剛好走到牠所在的格子</b>，才能把牠踢回馬廄。</li>
          <li>自己的馬也不能重疊或跨越。馬槽裡同樣不能越過或停在己方的馬上面。</li>
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
