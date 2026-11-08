import './privacy-policy.css'

export function PrivacyPolicy() {
  return <article className="privacy-policy">
    <header><span className="eyebrow">개인정보 보호</span><h1>개인정보처리방침</h1><p>zello가 처리하는 정보와 보관 기준, 이용자의 권리를 안내합니다.</p><p className="privacy-effective">시행일 · 2026년 11월 9일</p></header>
    <section><h2>1. 운영 주체와 문의</h2><p>개인정보처리자는 zello이며, 개인정보 보호와 고충 처리는 zello 운영팀이 담당합니다. 열람·정정·삭제·처리정지 및 탈퇴 요청은 <a href="mailto:97choijw@gmail.com">97choijw@gmail.com</a>으로 보내 주세요. 본인 확인에 필요한 최소한의 정보를 확인한 뒤 결과를 안내합니다.</p></section>
    <section><h2>2. 처리하는 정보와 목적</h2><div className="privacy-table-wrap"><table><thead><tr><th scope="col">구분</th><th scope="col">처리 항목</th><th scope="col">이용 목적</th></tr></thead><tbody>
      <tr><th scope="row">GitHub 로그인</th><td>GitHub 식별번호·아이디, 프로필 이름·이미지 주소, GitHub가 제공한 이메일, 로그인 시각</td><td>회원 식별, 로그인, 프로젝트 멤버 표시</td></tr>
      <tr><th scope="row">GitHub 연결</th><td>접근 토큰 등 인증·권한 정보, 연결한 조직·저장소 정보</td><td>접근 권한 확인, 이슈·코드 검토 요청의 조회와 반영</td></tr>
      <tr><th scope="row">프로젝트 협업</th><td>프로젝트·멤버·초대 정보, 작업·회의 메모·PR·검토·업데이트 내용, 담당자·작성자·활동 기록</td><td>팀 협업, 진행 현황·알림·개발 기록 제공</td></tr>
      <tr><th scope="row">서비스 이용</th><td>세션 식별정보, 접속 IP·시각·요청 경로·오류 기록, 테마·프로젝트 선택 등 브라우저 설정</td><td>로그인 유지, 사용 환경 저장, 장애 대응과 보안</td></tr>
      <tr><th scope="row">문의</th><td>회신 주소, 문의 내용, 본인 확인에 필요한 정보</td><td>문의 및 개인정보 권리 요청 처리</td></tr>
    </tbody></table></div><p>GitHub 비밀번호는 수집하지 않습니다. 이메일은 GitHub에서 제공하는 경우에 처리하며 별도 입력을 요구하지 않습니다. 협업 내용에는 서비스 이용에 필요한 정보만 작성해 주세요.</p></section>
    <section><h2>3. 팀 공유와 GitHub 연동</h2><p>같은 프로젝트의 멤버는 권한에 따라 다른 멤버의 이름·아이디·담당 업무와 프로젝트 내용을 확인할 수 있습니다. 공개한 팀 업데이트는 공개 링크를 가진 사람이 확인할 수 있습니다.</p><p>이용자가 이슈 발행, 코드 검토 요청·의견 작성, 코드 반영 등 GitHub 연동 기능을 실행하면 해당 내용과 계정 참조 정보가 GitHub에 전달됩니다. GitHub에서의 공개 범위와 보관은 저장소 설정 및 <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub 개인정보처리방침</a>을 따릅니다. zello에서 탈퇴하거나 데이터를 삭제해도 GitHub에 이미 반영된 내용이 함께 삭제되지는 않습니다.</p><p>개인정보를 광고 목적으로 판매하거나 제공하지 않습니다. 위 협업·연동 외의 제3자 제공이 필요한 경우에는 별도의 법적 근거 또는 동의에 따라 처리합니다.</p></section>
    <section><h2>4. 처리 위탁과 국외 보관</h2><p>서비스 제공 계약의 이행에 필요한 서버 운영과 데이터 보관을 Google Cloud에 위탁하며, 현재 운영 서버는 미국에 있습니다.</p><dl>
      <div><dt>이전받는 자·연락처</dt><dd>Google LLC · <a href="https://support.google.com/policies/troubleshooter/7575787" target="_blank" rel="noopener noreferrer">Google 개인정보 문의</a></dd></div>
      <div><dt>국가</dt><dd>미국 · Google Cloud us-central1</dd></div>
      <div><dt>이전 항목</dt><dd>2항의 회원·인증·협업·서비스 이용 정보 중 서버에서 처리하는 정보</dd></div>
      <div><dt>시기와 방법</dt><dd>로그인·서비스 이용 시 암호화된 통신으로 전송하여 서버에 보관</dd></div>
      <div><dt>목적·보관 기간</dt><dd>서버·DB·로그·백업의 운영과 보관 · 5항의 항목별 기간까지</dd></div>
      <div><dt>거부 방법·효과</dt><dd>이용을 중단하고 문의 이메일로 탈퇴·삭제를 요청할 수 있습니다. 국외 보관을 거부하면 해당 서버를 사용하는 서비스를 제공하기 어렵습니다.</dd></div>
    </dl><p>위탁 처리에 관한 Google의 안내는 <a href="https://cloud.google.com/terms/data-processing-addendum" target="_blank" rel="noopener noreferrer">Google Cloud 데이터 처리 부속약정</a>에서 확인할 수 있습니다.</p></section>
    <section><h2>5. 보관 기간과 파기</h2><ul>
      <li><strong>회원·협업 정보:</strong> 서비스 제공 기간 동안 보관하고, 탈퇴·삭제 요청을 처리하거나 이용 목적이 끝나면 지체 없이 파기합니다. 공동 작업 기록은 관련 권리와 보관 필요성을 확인해 삭제 또는 개인을 식별할 수 없도록 처리합니다.</li>
      <li><strong>인증·세션 정보:</strong> 로그인·연동 유지에 필요한 기간 동안 보관합니다. 로그인 세션은 기본적으로 마지막 이용 후 30분이 지나면 만료됩니다.</li>
      <li><strong>장애·보안 운영 로그:</strong> 생성일부터 최대 30일 보관한 뒤 삭제합니다.</li>
      <li><strong>복구용 백업:</strong> 생성일부터 최대 30일 보관한 뒤 삭제합니다. 원본에서 삭제한 정보가 백업에 남아 있는 동안에는 복구 외의 목적으로 이용하지 않으며, 복원 시 삭제 요청도 다시 반영합니다.</li>
      <li><strong>문의 기록:</strong> 문의 또는 권리 요청의 처리가 완료된 날부터 최대 30일 후 파기합니다.</li>
    </ul><p>법령상 보관 의무가 있는 정보는 해당 법령의 항목과 기간에 한해 분리 보관하고, 그 근거와 기간을 요청자에게 안내합니다. 전자 기록은 복구하기 어렵도록 삭제하며, 종이 기록이 있는 경우에는 분쇄 또는 소각합니다.</p></section>
    <section><h2>6. 이용자의 권리</h2><p>본인 또는 법정대리인 등 적법한 대리인은 열람·정정·삭제·처리정지, 동의 철회와 탈퇴를 문의 이메일로 요청할 수 있습니다. 법령상 제한이 있는 경우에는 사유를 안내합니다. 프로젝트 나가기는 해당 프로젝트의 참여를 종료하는 기능이며, zello 계정의 탈퇴·삭제는 운영팀으로 요청해 주세요.</p><p>GitHub 연결 권한은 GitHub 설정의 Applications에서 철회할 수 있습니다. 연결 철회와 zello에 저장된 정보의 삭제는 별도이므로 삭제가 필요하면 함께 요청해 주세요.</p></section>
    <section><h2>7. 쿠키와 브라우저 저장소</h2><p>로그인 유지를 위한 필수 세션 쿠키와 테마·프로젝트 선택·시작 단계·초대 복귀 경로 등을 기억하기 위한 브라우저 저장소를 사용합니다. 광고·행태 분석용 추적 쿠키는 사용하지 않습니다. 브라우저 설정에서 쿠키와 사이트 데이터를 삭제·차단할 수 있으며, 차단하면 로그인과 일부 설정 유지 기능이 제한될 수 있습니다.</p></section>
    <section><h2>8. 안전한 처리와 방침 변경</h2><p>HTTPS 통신, 프로젝트별 접근 권한 확인, 서버에 저장하는 세션 속성의 암호화, 운영 계정 접근 제한 등을 적용합니다. 목적에 필요한 범위에서만 정보에 접근하도록 관리합니다.</p><p>이 방침은 2026년 11월 9일부터 적용합니다. 변경 시 시행일과 변경 내용을 서비스에서 안내하며, 별도 고지나 동의가 필요한 경우에는 그 절차를 따릅니다.</p></section>
    <footer className="privacy-policy-source">관련 법령: <a href="https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029332621" target="_blank" rel="noopener noreferrer">개인정보 보호법 제30조</a> · <a href="https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334869" target="_blank" rel="noopener noreferrer">제28조의8</a></footer>
  </article>
}
