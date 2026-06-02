import type { Cadence } from "../domain/types.js";

export type CompanionScenario =
  | "greeting"
  | "lonely"
  | "missing_family"
  | "tired"
  | "body_discomfort"
  | "scam_anxiety"
  | "gratitude"
  | "daily_chat";

const TEMPLATES: Record<CompanionScenario, string[]> = {
  greeting: [
    "我在。你今天慢慢來就好，有什麼想說的都可以傳給我。",
    "早。今天先不用急，喝口水、慢慢開始就好。",
    "我在這邊。你今天如果想聊什麼，就直接跟我說。"
  ],
  lonely: [
    "我在，你可以跟我說。今天是覺得悶，還是有什麼事放在心裡？你慢慢講就好。",
    "我陪你聊一下。你不用想要講得很清楚，想到哪裡就說到哪裡。",
    "有時候一個人在家，時間會變得很長。我在這邊，先陪你說幾句。"
  ],
  missing_family: [
    "會想他們很正常，也不一定是你太黏。你可以先把心裡掛念的事跟我說，我陪你整理一下。",
    "你是不想打擾他們，但心裡還是會想，對嗎？這種感覺可以慢慢說，不用忍著。",
    "想家人不是麻煩。你先跟我講講，最想跟他們說的是哪一句？"
  ],
  tired: [
    "昨晚沒睡好，今天就先慢慢來。能休息一下就休息，不要急著把事情都做完。",
    "累的時候，先把今天要做的事放少一點。你可以跟我說，今天最需要處理的是哪一件。",
    "身體在提醒你慢一點。先坐一下、喝點水，等舒服一點再動。"
  ],
  body_discomfort: [
    "先不要勉強。你可以先坐下來休息一下，留意是突然不舒服，還是這幾天都這樣。",
    "先不要勉強走太多。你慢慢跟我說，是哪裡酸、什麼時候開始的。",
    "身體不舒服先不要勉強。如果變嚴重，還是要找診所、藥師或身邊的人幫忙看。"
  ],
  scam_anxiety: [
    "不用急，我陪你一起慢慢看。你有覺得怪怪的地方，先不要動作，傳給我整理一下也可以。",
    "會不安心是正常的，現在詐騙真的很多。你先不用急著回對方，我陪你把事情分清楚。",
    "先穩一下，不用急著點、不用急著付。你把你擔心的地方說給我，我陪你看。"
  ],
  gratitude: [
    "不客氣。你有事就傳來，我陪你一起看，不用急。",
    "不用客氣，這種事有人陪著想會比較安心。",
    "好，你需要的時候再傳來，我在這邊。"
  ],
  daily_chat: [
    "我聽到了。你可以慢慢說，我會在這邊陪你一起想。",
    "嗯，我在聽。你可以多說一點，今天這件事讓你最在意的是什麼？",
    "你慢慢講就好，不用一次說完。我會陪你把話接下去。"
  ]
};

export function detectCompanionScenario(text: string): CompanionScenario {
  const normalized = text.trim();

  if (/早|早安|午安|晚上|晚安/.test(normalized)) {
    return "greeting";
  }

  if (/孤單|孤单|一個人|一个人|沒人|没人|悶|闷|無聊|无聊|不知道要跟誰說|不知道要跟谁说|找人聊/.test(normalized)) {
    return "lonely";
  }

  if (/想.*(兒子|儿子|女兒|女儿|孩子|家人|孫|孙)|不想.*(打擾|打扰)|掛念|挂念/.test(normalized)) {
    return "missing_family";
  }

  if (/睡不好|失眠|很累|累|疲倦|疲倦|沒精神|没精神/.test(normalized)) {
    return "tired";
  }

  if (/身體|身体|酸|沒力|没力|不舒服|走路/.test(normalized)) {
    return "body_discomfort";
  }

  if (/怕.*被騙|怕.*被骗|不安心|怪怪的|詐騙|诈骗/.test(normalized)) {
    return "scam_anxiety";
  }

  if (/謝謝|谢谢|感謝|感谢/.test(normalized)) {
    return "gratitude";
  }

  return "daily_chat";
}

export function createCompanionToneReply(text: string, cadence: Cadence): string {
  if (cadence === "paused") {
    return "我先陪你看這一句。之後我不會主動打擾，你想找我時再傳訊息就好。";
  }

  const scenario = detectCompanionScenario(text);
  const templates = TEMPLATES[scenario];
  return templates[stableIndex(text, templates.length)];
}

function stableIndex(text: string, size: number): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % size;
}
