import React, { useEffect } from "react";
import { markFtueDone } from "../utils/ftue";
import { FTUE_STEP_IDS } from "../config/ftueSteps";

export default function Estimate() {
  // FTUE: APARTMENT 프로젝트 확인 방문 시 step 완료
  useEffect(() => {
    markFtueDone("APARTMENT", "view_result", FTUE_STEP_IDS.APARTMENT);
  }, []);

  return (
    <div className="p-6 text-gray-200">
      <h1 className="text-xl font-semibold mb-2">프로젝트 페이지</h1>
    </div>
  );
}
