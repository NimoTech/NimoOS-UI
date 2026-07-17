// 音频转录 / 摘要数据。
// 数据来源：用户放在 /DATA/Media/audio/ 的字幕文件（S01E04_2026714215220.srt / .txt），
// 由 SRT 解析、按说话人切分并合并为段落而来 —— 智能章节、说话人分离、重点句高光都基于真实字幕内容。
// SRT 本身没有说话人标注，说话人分离是按对白内容预生成的标注：主要说话人按首次出现顺序
// 匿名编号 Speaker 1–6；路人（店员/护士/来客/电视声）不标注 speaker（UI 视为「未分离」）。
// 设备上没有实时语音转写服务（无 whisper），所以这里是「预生成」的固定数据；
// 接入真实后端（NimoOS-AI + STT/分段/向量化）后，把 lookupTranscript 换成异步请求即可，UI 不用改。
// key = 文件名小写。

export interface TranscriptSegment {
  /** 起始时间，格式 m:ss，用于展示与点击跳转 */
  t: string
  text: string
  /** 说话人 id（说话人分离）——对应 AudioTranscript.speakers；缺省表示未分离 */
  speaker?: string
  /** 是否金句/重点句（重点高光）——后端标注；缺省 false */
  highlight?: boolean
}
/** 智能章节：把转录按主题切段，标题可点击跳转到 t。 */
export interface TranscriptChapter {
  /** 章节标题 */
  title: string
  /** 章节起点时间 m:ss（对齐某个分段的 t） */
  t: string
}
/** 说话人（说话人分离）：给 segment.speaker 提供显示名。 */
export interface TranscriptSpeaker {
  id: string
  name: string
}
export interface AudioTranscript {
  /** 一段话摘要 */
  summary: string
  /** 关键词标签 */
  keywords: string[]
  /** 分段转录（顺序即时间顺序） */
  segments: TranscriptSegment[]
  /** 智能章节（可选）——为空则不显示章节头 */
  chapters?: TranscriptChapter[]
  /** 说话人名单（可选）——为空则不显示说话人标签 */
  speakers?: TranscriptSpeaker[]
}

const TRANSCRIPTS: Record<string, AudioTranscript> = {
  's01e04_2026714215220.mp3': {
    summary:
      'The full audio track of a sitcom episode — an ensemble comedy among six friends (diarized anonymously as Speaker 1–6; a few walk-ons — delivery guy, nurse, visiting friends, a waiting-room TV — are left unlabeled). Speaker 3 and Speaker 4 bring hockey tickets to celebrate Speaker 5\'s birthday, only to collide with the anniversary of his "first time" with his ex-wife. Speaker 6 gets her first-ever paycheck, then a visit from old friends leaves her doubting her decision to start over on her own. At girls\' night, Speaker 2 consoles everyone with the story of Jack and the magic beans; meanwhile Speaker 5 takes a hockey puck to the face and ends up in the ER. A pizza delivered to the wrong door reveals that George Stephanopoulos lives across the street. In the ER, Speaker 5 confesses that Carol was his first, while back at the apartment the girls trade embarrassing secrets. Everyone winds up playing Twister, and Speaker 5 takes over Speaker 6\'s credit-card courtesy call to deliver the closing line: "I\'m fine."',
    keywords: ['sitcom', 'birthday & anniversary', 'first paycheck', 'FICA', 'magic beans', 'floopy', 'hockey', 'emergency room', 'George Stephanopoulos', 'Twister'],
    chapters: [
      { title: 'Cold open: a sleepless night', t: '0:09' },
      { title: 'Hockey tickets & October 20th', t: '0:52' },
      { title: 'First paycheck: who\'s FICA?', t: '2:25' },
      { title: 'Old friends drop by', t: '3:58' },
      { title: 'Rinkside memories of Carol', t: '4:49' },
      { title: 'Girls\' night & the Visa call', t: '6:50' },
      { title: 'Magic beans & a floopy life', t: '8:59' },
      { title: 'A puck to the face', t: '10:46' },
      { title: 'The wrong-door celebrity pizza', t: '12:15' },
      { title: 'Waiting at the ER', t: '14:33' },
      { title: 'Spying across the street', t: '15:02' },
      { title: 'The first-time confession', t: '15:34' },
      { title: 'Trading embarrassing secrets', t: '16:55' },
      { title: 'Drop the towel!', t: '18:05' },
      { title: 'Getting the puck back', t: '18:48' },
      { title: 'Twister & "I\'m fine"', t: '19:52' },
    ],
    speakers: [
      { id: 's1', name: 'Speaker 1' },
      { id: 's2', name: 'Speaker 2' },
      { id: 's3', name: 'Speaker 3' },
      { id: 's4', name: 'Speaker 4' },
      { id: 's5', name: 'Speaker 5' },
      { id: 's6', name: 'Speaker 6' },
    ],
    segments: [
      { t: '0:09', speaker: 's1', text: 'How does she do that? I cannot sleep in a public place. Would you look at her — she\'s so peaceful.' },
      { t: '0:24', speaker: 's1', text: 'It\'s okay, you know, you just nodded off again. What\'s going on with you?' },
      { t: '0:28', speaker: 's2', highlight: true, text: 'I got no sleep last night. My grandmother has this new boyfriend, and they\'re both kind of insecure… and deaf. They keep having to reassure each other that they\'re having a good time — you have no idea how loud they are.' },
      { t: '0:48', speaker: 's1', text: 'Well, if you want, you can stay with Rachel and me tonight.' },
      { t: '0:52', speaker: 's3', text: '…95, 96, 97. See, I told you — less than a hundred steps from our place to here.' },
      { t: '0:59', speaker: 's4', text: 'You got way too much free time.' },
      { t: '1:01', speaker: 's3', text: 'Hey, here\'s the birthday boy! Ross, check it out: hockey tickets, Rangers–Penguins, tonight at the Garden — and we\'re taking you.' },
      { t: '1:10', speaker: 's4', text: 'Happy birthday, pal. We love you, man.' },
      { t: '1:13', speaker: 's5', text: 'It\'s funny — my birthday was seven months ago. So I\'m guessing you had an extra ticket, and couldn\'t decide which one of you got to bring a date?' },
      { t: '1:26', speaker: 's4', highlight: true, text: 'Well, aren\'t we Mr. The-Glass-Is-Half-Empty.' },
      { t: '1:28', speaker: 's5', text: 'Oh my God — is today the 20th? October 20th? I was hoping you wouldn\'t remember.' },
      { t: '1:35', speaker: 's3', text: 'What\'s wrong with the 20th?' },
      { t: '1:37', speaker: 's4', text: 'Eleven days before Halloween — all the good costumes are gone?' },
      { t: '1:42', speaker: 's5', highlight: true, text: 'Today\'s the day Carol and I first consummated our physical relationship. …Sex. You know what? I\'d better pass on the game. I think I\'m just going to go home and think about my ex-wife and her lesbian lover.' },
      { t: '2:03', speaker: 's4', text: 'The hell with hockey — let\'s all do that! Come on, Ross: you, me, Joey, ice — guys\' night out. What do you say, big guy?' },
      { t: '2:16', speaker: 's5', text: 'What are you doing?' },
      { t: '2:17', speaker: 's4', text: 'I have no idea.' },
      { t: '2:18', speaker: 's5', text: 'All right, all right — maybe it\'ll take my mind off it. Do you promise to buy me a big foam finger?' },
      { t: '2:23', speaker: 's4', text: 'You got it.' },
      { t: '2:25', speaker: 's6', text: 'All right! Look-look-look, I got my first paycheck!' },
      { t: '2:30', speaker: 's2', text: 'I remember my first paycheck — there was a cave-in in one of the mines, and eight people were killed.' },
      { t: '2:38', speaker: 's1', text: 'Wow. You worked in a mine?' },
      { t: '2:41', speaker: 's2', highlight: true, text: 'No, I worked at a Dairy Queen. Why?' },
      { t: '2:46', speaker: 's6', highlight: true, text: 'I earned this. I wiped tables for it, I steamed milk for it — and it was totally… not worth it. Who\'s FICA? Why is he getting all my money?' },
      { t: '3:04', speaker: 's1', text: 'Chandler, look at that.' },
      { t: '3:06', speaker: 's4', text: 'Oh, this is not that bad.' },
      { t: '3:08', speaker: 's3', text: 'Oh, you\'re fine — yeah, for a first job. You can totally, totally live on this.' },
      { t: '3:15', speaker: 's6', text: 'Oh, yeah. Yeah.' },
      { t: '3:17', speaker: 's4', text: 'Hey, by the way — great service today.' },
      { t: '3:27', speaker: 's3', text: 'Hockey!' },
      { t: '3:41', speaker: 's4', highlight: true, text: '…I\'ve seen birds do this on Wild Kingdom.' },
      { t: '3:58', speaker: 's6', text: 'What are you guys doing here?' },
      { t: '4:00', text: 'Well, we were in the city shopping, and your mom said you work here — and it\'s true!' },
      { t: '4:08', text: 'Look at you in the apron! You look like you\'re in a play.' },
      { t: '4:18', speaker: 's6', text: 'I know, I know — I\'m a duplex. So, what\'s going on with you?' },
      { t: '4:22', text: 'Well, guess who my dad\'s making partner in his firm?' },
      { t: '4:49', speaker: 's4', highlight: true, text: 'We\'ll take a brief time-out while Messier stops to look at some women\'s shoes.' },
      { t: '4:56', speaker: 's5', text: 'Carol was wearing boots just like those the night that we — we first — you know. In fact, she, uh… she never took them off. Because we— Sorry. Sorry.' },
      { t: '5:15', speaker: 's3', text: 'What?' },
      { t: '5:17', speaker: 's5', text: 'Peach pit.' },
      { t: '5:18', speaker: 's4', highlight: true, text: 'Yes, Bunny?' },
      { t: '5:20', speaker: 's5', text: 'Peach pit. That night we, uh — we had peaches. Actually, nectarines, but basically it could have been a peach. Then we, uh… then we got dressed, and I — I walked her to the bus stop. …I\'m fine.' },
      { t: '5:40', speaker: 's3', highlight: true, text: 'Hey, that woman\'s got an ass like Carol\'s! …What? I thought we were trying to find stuff.' },
      { t: '5:51', speaker: 's6', text: 'Oh, come on, you guys — tell me all the dirt!' },
      { t: '5:54', text: 'Well, the biggest news is still you dumping Barry at the altar.' },
      { t: '6:00', text: 'All right, let\'s talk reality for a second — when are you coming home?' },
      { t: '6:05', speaker: 's6', text: 'What? Guys, I\'m not.' },
      { t: '6:08', text: 'Come on, this is us.' },
      { t: '6:10', speaker: 's6', highlight: true, text: 'I\'m not! This is what I\'m doing now. I\'ve got this job — okay, I\'m not just waitressing. I, um… I write the specials on the specials board, and I take the dead flowers out of the vase… Oh, and sometimes Arturo lets me put the little chocolate blobbies on the cookies.' },
      { t: '6:39', text: 'Well! Your mom didn\'t tell us about the blobbies.' },
      { t: '6:50', speaker: 's1', text: 'How was it with your friends? …Would you like some Tiki Death Punch?' },
      { t: '7:00', speaker: 's6', text: 'What\'s that?' },
      { t: '7:02', speaker: 's1', text: 'Well, it\'s rum, and—' },
      { t: '7:04', speaker: 's6', text: 'Okay.' },
      { t: '7:08', speaker: 's1', text: 'We thought since Phoebe was staying over tonight, we\'d have kind of like a slumber-party thing. We got some trashy magazines, we got cookie dough, we got Twister…' },
      { t: '7:18', speaker: 's2', highlight: true, text: 'Ooh! And I brought Operation. But, um, I lost the tweezers, so we can\'t operate. But we can prep the guy!' },
      { t: '7:29', speaker: 's1', text: 'Rach, it\'s the Visa card people.' },
      { t: '7:32', speaker: 's6', text: 'Oh, God. Ask them what they want.' },
      { t: '7:34', speaker: 's1', text: 'Could you please tell me what this is in reference to? …Yes, hold on. Um — they say there\'s been some unusual activity on your account.' },
      { t: '7:43', speaker: 's6', text: 'But I haven\'t used my card in weeks!' },
      { t: '7:46', speaker: 's1', text: 'That is the unusual activity. Look, they just want to see if you\'re okay.' },
      { t: '7:49', speaker: 's6', highlight: true, text: 'They want to know if I\'m okay?! Okay, let\'s see: the FICA guys took all my money, everyone I know is either getting married or getting pregnant or getting promoted — and I\'m getting coffee, and it\'s not even for me! So if that sounds like I\'m okay, okay, then you can tell them I\'m okay. Okay?' },
      { t: '8:11', speaker: 's1', text: 'Uh — Rachel has left the building. Can you call back?' },
      { t: '8:17', speaker: 's6', text: 'I\'m sorry. Sorry.' },
      { t: '8:30', speaker: 's5', text: 'Uh-oh. …There was ice there that night with Carol.' },
      { t: '8:41', speaker: 's4', highlight: true, text: 'Plastic seats — four thousand angry Pittsburgh fans.' },
      { t: '8:46', speaker: 's5', text: 'No, actually I was just saying it looks like we\'re not sitting together. But now that you mention it — there was ice there that night. It was the first frost…' },
      { t: '8:56', speaker: 's4', text: 'Just sit. Sit down. Sit.' },
      { t: '8:59', speaker: 's1', text: 'You should feel great about yourself — you\'re doing this amazing independent thing!' },
      { t: '9:05', speaker: 's6', text: 'Monica, what is so amazing? I gave up, like, everything. And for what?' },
      { t: '9:12', speaker: 's2', text: 'You are just like Jack.' },
      { t: '9:14', speaker: 's6', text: '…Jack from downstairs?' },
      { t: '9:16', speaker: 's2', text: 'No — Jack and the Beanstalk.' },
      { t: '9:18', speaker: 's6', text: 'Ah, the other Jack.' },
      { t: '9:20', speaker: 's2', highlight: true, text: 'Yeah! See, he gave up something, but then he got those magic beans. And then he woke up, and there was this — this big plant outside of his window, full of possibilities and stuff. And he lived in a village — and you live in the Village!' },
      { t: '9:36', speaker: 's6', text: 'Okay, but Pheebs — Jack gave up a cow. I gave up an orthodontist. Okay, I know, I know I didn\'t love him, but—' },
      { t: '9:45', speaker: 's2', text: 'Oh, see — Jack did love the cow.' },
      { t: '9:48', speaker: 's6', text: 'But see, it was a plan, you know? It was clear. Everything was figured out. And now everything\'s just kind of, like…' },
      { t: '9:56', speaker: 's2', text: 'Floopy?' },
      { t: '9:58', speaker: 's6', text: 'Yeah.' },
      { t: '10:00', speaker: 's1', highlight: true, text: 'Look, you\'re not the only one. I mean, half the time we don\'t know where we\'re going. You\'ve just got to figure that at some point it\'s all going to come together — and it\'s just going to be… un-floopy.' },
      { t: '10:10', speaker: 's2', text: 'Oh, like that\'s a word.' },
      { t: '10:13', speaker: 's6', text: 'Okay, but Monica — what if, what if it doesn\'t come together?' },
      { t: '10:21', speaker: 's1', text: '…Pheebs?' },
      { t: '10:23', speaker: 's2', text: 'Well… \'cause… you just— I don\'t like this question.' },
      { t: '10:27', speaker: 's6', highlight: true, text: 'Okay, see? See, you guys — what if we don\'t get magic beans? I mean, what if all we\'ve got are… beans?' },
      { t: '10:46', speaker: 's5', text: '…A bunch of toothless guys hitting each other with sticks.' },
      { t: '10:50', speaker: 's3', text: 'Well, pass it! Pass it! He\'s open! Shoot it! Shoot it!' },
      { t: '10:52', speaker: 's4', text: 'Hey, look — we\'re on that TV thing!' },
      { t: '11:21', speaker: 's4', highlight: true, text: 'It says to call this number if you\'re not completely satisfied with this candy bar. …Well, I\'m not completely satisfied.' },
      { t: '11:32', speaker: 's4', highlight: true, text: 'Listen — it\'s kind of an emergency. Well, I guess you\'d know that… or we\'d be in the predicament room.' },
      { t: '11:40', text: 'Now sit over there.' },
      { t: '11:42', speaker: 's5', text: 'Look, I don\'t want to make any trouble, okay? But I\'m in a lot of pain here. My face is dented.' },
      { t: '11:48', text: 'Well, you\'ll have to wait your turn.' },
      { t: '11:51', speaker: 's5', text: 'Well, how long do you think it\'ll be?' },
      { t: '11:54', text: 'Any minute now.' },
      { t: '12:15', speaker: 's6', text: 'Hey… I\'m so sorry, you guys. I didn\'t mean to bring you down.' },
      { t: '12:20', speaker: 's1', text: 'No — you were right. I don\'t have a plan.' },
      { t: '12:28', speaker: 's6', text: 'Pheebs, do you have a plan?' },
      { t: '12:31', speaker: 's2', highlight: true, text: 'I don\'t even have a "pla".' },
      { t: '12:35', text: 'Hi — one mushroom, green pepper and onion?' },
      { t: '12:39', speaker: 's6', text: 'No, no — that\'s not what we ordered. We ordered a fat-free crust with extra cheese.' },
      { t: '12:49', text: 'Wait — you\'re not "G. Stephanopoulos"? Oh, man, my dad\'s gonna kill me!' },
      { t: '12:55', speaker: 's1', text: 'Wait — did you say "G. Stephanopoulos"?' },
      { t: '12:58', text: 'Yeah, this one goes across the street — I must have given him yours. Oh, bonehead! Bonehead!' },
      { t: '13:05', speaker: 's1', highlight: true, text: 'Wait — was this a small Mediterranean guy with curiously intelligent good looks?' },
      { t: '13:10', text: 'Yeah, that sounds about right.' },
      { t: '13:12', speaker: 's1', text: 'Was he — was he wearing a stunning blue suit? And — and a power tie?' },
      { t: '13:17', text: 'No. Pretty much just a towel.' },
      { t: '13:19', speaker: 's1', text: 'Oh, God.' },
      { t: '13:22', text: 'So, you guys want me to take this back?' },
      { t: '13:24', speaker: 's1', highlight: true, text: 'What, are you nuts?! We\'ve got George Stephanopoulos\' pizza!' },
      { t: '13:31', speaker: 's6', text: 'Uh, Pheebs? Who\'s George Snuffleupagus?' },
      { t: '13:36', speaker: 's2', highlight: true, text: 'That\'s Big Bird\'s friend.' },
      { t: '13:40', speaker: 's6', text: 'Oh my God — I want to see! Let me see! Let me see!' },
      { t: '13:48', speaker: 's1', text: 'You know — the White House advisor? Clinton\'s campaign guy? The one with the great hair?' },
      { t: '13:54', speaker: 's6', text: 'What\'s he wearing?' },
      { t: '13:56', speaker: 's1', text: 'Uh, a blue shirt. Nice hair. Sexy smile… really cute butt.' },
      { t: '14:00', speaker: 's2', text: 'Oh! Oh, wait — I see a woman.' },
      { t: '14:04', speaker: 's1', text: 'Tell me it\'s his mother.' },
      { t: '14:06', speaker: 's2', text: 'It\'s definitely not his mother.' },
      { t: '14:08', speaker: 's1', text: 'Oh, no…' },
      { t: '14:10', speaker: 's2', highlight: true, text: 'Oh, wait — she\'s walking across the floor… she\'s walking… she\'s walking… she\'s going for the pizza! Hey — that\'s not for you, bitch!' },
      { t: '14:33', speaker: 's4', highlight: true, text: 'Excuse me — look, we\'ve been here for over an hour, and a lot of people less sick than my friend have gone in. I mean, that guy with the toe thing? Who\'s he sleeping with?' },
      { t: '14:46', text: 'Oh, come on, Dora — don\'t be mad. I know we both said some things we didn\'t mean, but that doesn\'t mean we still don\'t love each other. …You know, I feel like I\'ve lost her.' },
      { t: '15:02', speaker: 's1', text: 'The light\'s still out?' },
      { t: '15:03', speaker: 's6', text: 'Yeah.' },
      { t: '15:04', speaker: 's1', text: 'Oh, maybe they\'re napping.' },
      { t: '15:06', speaker: 's6', text: 'Oh, please — they\'re having sex.' },
      { t: '15:09', speaker: 's1', text: 'So, what do you think George is like?' },
      { t: '15:19', speaker: 's2', text: 'I think he\'s shy.' },
      { t: '15:21', speaker: 's6', text: 'Oh, yeah?' },
      { t: '15:22', speaker: 's2', highlight: true, text: 'Yeah. I think you have to draw him out — and then, when you do… he\'s a preppy animal.' },
      { t: '15:34', speaker: 's5', text: 'I remember the moonlight coming in through the open window — and her face had the most incredible glow.' },
      { t: '15:40', speaker: 's4', highlight: true, text: 'Yes, the moon, the glow, the magical feeling — you did this part. …Could I get some painkillers over here, please?' },
      { t: '15:49', speaker: 's3', highlight: true, text: 'He\'s right — enough already. What is the big deal about today? So you slept with her for the first time — so what? You slept with her for seven years after that.' },
      { t: '15:59', speaker: 's5', text: 'Look, it\'s just a little more complicated than that.' },
      { t: '16:02', speaker: 's4', text: 'Well, what? What? What is it? That she left you? That she likes women? That she left you for another woman that likes women?' },
      { t: '16:07', speaker: 's5', highlight: true, text: 'A little louder, okay? I think there\'s a man on the twelfth floor, in a coma, who didn\'t quite hear you.' },
      { t: '16:15', speaker: 's3', text: 'Then what?' },
      { t: '16:17', speaker: 's5', text: 'My first time with Carol was…' },
      { t: '16:20', speaker: 's3', text: 'What?' },
      { t: '16:24', speaker: 's5', highlight: true, text: '…It was my first time.' },
      { t: '16:33', speaker: 's3', text: 'With Carol?!' },
      { t: '16:41', speaker: 's4', text: 'So, in your whole life, you\'ve only been with one—…' },
      { t: '16:45', speaker: 's3', highlight: true, text: 'Oh. …Boy, hockey was a big mistake. There\'s a whole bunch of stuff we could have done tonight.' },
      { t: '16:55', speaker: 's1', text: 'Okay, okay — I got one. Do you remember that vegetarian pâté that I made, that you love so much?' },
      { t: '17:04', speaker: 's2', text: 'Uh-huh.' },
      { t: '17:06', speaker: 's1', highlight: true, text: 'Well — unless goose is a vegetable… ha!' },
      { t: '17:11', speaker: 's2', text: 'Oh! Okay, fine, fine. Now I don\'t feel so bad about sleeping with Jason Hurley.' },
      { t: '17:17', speaker: 's1', text: 'What?! You slept with Jason?' },
      { t: '17:19', speaker: 's2', text: 'Oh, you\'d already broken up.' },
      { t: '17:21', speaker: 's1', text: 'How long?' },
      { t: '17:23', speaker: 's2', highlight: true, text: 'Just a couple hours.' },
      { t: '17:24', speaker: 's1', text: 'Oh, that\'s nice!' },
      { t: '17:26', speaker: 's6', text: 'Okay, okay, okay — I got one. Anyway… the valentine Tommy Rowland left in your locker was really from me.' },
      { t: '17:36', speaker: 's1', text: 'Excuse me?!' },
      { t: '17:38', speaker: 's6', text: 'Hello! Like he was really going to send you one. …She was a big girl.' },
      { t: '17:47', speaker: 's1', highlight: true, text: 'Really. Well, at least "big girls" don\'t pee in their pants in seventh grade!' },
      { t: '17:54', speaker: 's6', text: 'I was laughing! You made me laugh!' },
      { t: '18:05', speaker: 's6', highlight: true, text: 'Oh, George, baby — drop the towel!' },
      { t: '18:07', speaker: 's1', text: 'Yeah, come on — drop the towel!' },
      { t: '18:08', speaker: 's2', text: 'You can do it! Drop the towel, drop the towel, drop the towel!' },
      { t: '18:12', speaker: 's2', text: '…Wow.' },
      { t: '18:17', speaker: 's3', text: 'Man, can you believe he\'s only had sex with one woman?' },
      { t: '18:23', speaker: 's4', text: 'I think it\'s great. You know… it\'s sweet. It\'s romantic.' },
      { t: '18:30', speaker: 's3', text: 'Really?' },
      { t: '18:31', speaker: 's4', highlight: true, text: 'No, are you kidding? The guy\'s a freak.' },
      { t: '18:34', speaker: 's3', text: 'Hey, man. Buddy!' },
      { t: '18:35', speaker: 's4', text: 'Oh — that\'s attractive.' },
      { t: '18:43', speaker: 's4', highlight: true, text: 'Oh, I thought you were great in Silence of the Lambs. …Oh, come on, admit it: all things considered, you had fun tonight.' },
      { t: '18:48', speaker: 's5', text: 'Fun? Where was the fun? Tell me specifically — which part was the fun part? …Where\'s my puck?' },
      { t: '18:52', speaker: 's3', text: 'Oh, uh — the kid has it.' },
      { t: '18:54', speaker: 's5', text: 'The kid…? Excuse me, uh — that\'s, that\'s my puck.' },
      { t: '18:57', highlight: true, text: 'I found it. Finders keepers, losers weepers.' },
      { t: '19:00', speaker: 's4', text: 'You\'ve got to do it, man.' },
      { t: '19:02', speaker: 's5', highlight: true, text: 'Oh, yeah? Well, I\'m rubber, you\'re glue — whatever you say bounces off me and sticks to you…' },
      { t: '19:21', speaker: 's5', text: 'Listen — give me back my puck.' },
      { t: '19:25', text: 'No.' },
      { t: '19:27', speaker: 's5', text: 'Yes! Come here — give me my puck!' },
      { t: '19:47', text: 'Hey! Hey — no roughhousing in my ER!' },
      { t: '19:51', speaker: 's5', highlight: true, text: '…Now that was fun.' },
      { t: '19:52', speaker: 's6', text: 'Okay, Monica: right foot red.' },
      { t: '20:00', speaker: 's4', highlight: true, text: 'We could have played Monopoly… but nooo.' },
      { t: '20:10', speaker: 's6', text: 'Okay, Pheebs: right hand blue. …Good.' },
      { t: '20:21', speaker: 's5', text: 'Hello? …Oh, uh — Rachel, it\'s the Visa card people.' },
      { t: '20:25', speaker: 's6', text: 'Oh, okay. Will you take my place?' },
      { t: '20:27', speaker: 's5', highlight: true, text: 'All right. …Yes, this is Rachel.' },
      { t: '20:29', speaker: 's5', text: 'Oh, yeah — no, I know. I haven\'t been using it much. …Oh, well, thanks — but I\'m okay, really.' },
      { t: '20:42', speaker: 's1', text: 'To the green! To the green!' },
      { t: '20:45', speaker: 's5', highlight: true, text: '…I\'ve got magic beans. …No, no — never mind.' },
      { t: '20:52', speaker: 's6', text: 'To the left! To the left! …Aww.' },
      { t: '20:55', speaker: 's5', highlight: true, text: '…I\'m fine.' },
    ],
  },
}

/** 按文件名查转录；未命中返回 null。 */
export function lookupTranscript(fileName: string): AudioTranscript | null {
  return TRANSCRIPTS[fileName.toLowerCase()] ?? null
}

/** m:ss / h:mm:ss → 秒，用于点击分段跳转播放器。 */
export function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map((n) => parseInt(n, 10))
  if (parts.some((n) => Number.isNaN(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}
