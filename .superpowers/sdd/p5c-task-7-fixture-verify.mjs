#!/usr/bin/env node
// SP8-P5c T7 —— fixture 抄本的**程序化逐字节等价校验**(治理 §4.4:不许肉眼比)。
//
// 校验对象:`src/ai/knowledge/parser/ParserTest.test.ts` 里 6 份 `FIXTURE-COPY` 抄本
//   5 份是活常量:MD_OK / TXT_RERANK / EMPTY_200 / ERR_400_TARGET / ERR_400_EXT
//   1 份(422)只抄在**文件头注释**里(UI 不可达 → 治理 §4.2/§5.1 明令不写单测、不建常量)
//     → 这一份从注释里抽出那一行 JSON 来校验。
//
// 判据:抄本 `JSON.parse` 后 re-serialize 的字节串,与 fixture 响应体 `JSON.parse` 后
// re-serialize 的字节串**逐码点相同**。`JSON.stringify` 保留插入顺序 →
// 这同时钉住了「键顺序 / 值 / 类型」三件事,比逐字符 diff 原文更强(原文差在缩进上无意义)。
//
// 用法:node .superpowers/sdd/p5c-task-7-fixture-verify.mjs [--mutate]
//   `--mutate` 做**变异验证**:把每份抄本各改一个字节,证明本脚本真的会报错(不是空转)。
import { readFileSync } from 'node:fs'

const FIX = '.superpowers/sdd/p5c-fixtures/'
const TEST = 'src/ai/knowledge/parser/ParserTest.test.ts'

/** `.http` fixture 的响应体 = 空行之后的部分;`.json` 就是整份。 */
function fixtureBody(f) {
  const raw = readFileSync(FIX + f, 'utf8')
  return (f.endsWith('.http') ? raw.slice(raw.indexOf('\n\n') + 2) : raw).trim()
}

const src = readFileSync(TEST, 'utf8')

/** 从测试文件里抽出 `const NAME = { … }` 的对象字面量原文(第 0 列的 `}` 收尾)。 */
function copyOf(name) {
  const start = src.indexOf(`const ${name} = {`)
  if (start < 0) throw new Error(`抄本常量 ${name} 找不到`)
  const braceAt = src.indexOf('{', start)
  const end = src.indexOf('\n}', braceAt)
  if (end < 0) throw new Error(`抄本常量 ${name} 没有第 0 列的收尾 }`)
  return src.slice(braceAt, end + 2)
}

/** 422 那一份:从文件头注释里抽出那行 JSON(以 `{"detail":` 开头的注释行)。 */
function copy422() {
  const m = /^\/\/\s+(\{"detail":\[.*\})$/m.exec(src)
  if (!m) throw new Error('422 抄本(注释里那一行 JSON)找不到')
  return m[1]
}

const CASES = [
  ['MD_OK', 'parser-test-analyze-md-ok.json', () => copyOf('MD_OK')],
  ['TXT_RERANK', 'parser-test-analyze-txt-rerank.json', () => copyOf('TXT_RERANK')],
  ['EMPTY_200', 'parser-test-analyze-200-empty-file.http', () => copyOf('EMPTY_200')],
  ['ERR_400_TARGET', 'parser-test-analyze-400-target-tokens.http', () => copyOf('ERR_400_TARGET')],
  ['ERR_400_EXT', 'parser-test-analyze-400-bad-ext.http', () => copyOf('ERR_400_EXT')],
  ['NO_FILE_422 (注释抄本)', 'parser-test-analyze-422-no-file.http', copy422],
]

/** 逐码点比较,返回第一处差异的描述(相同则 null)。 */
function firstDiff(a, b) {
  if (a === b) return null
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a.codePointAt(i) !== b.codePointAt(i)) {
      return `offset ${i}: 抄本 U+${a.codePointAt(i).toString(16).toUpperCase().padStart(4, '0')} ` +
        `(${JSON.stringify(a[i])}) vs fixture U+${b.codePointAt(i).toString(16).toUpperCase().padStart(4, '0')} ` +
        `(${JSON.stringify(b[i])})`
    }
  }
  return `长度不同:抄本 ${a.length} vs fixture ${b.length}`
}

const mutate = process.argv.includes('--mutate')
let bad = 0

console.log(mutate ? '=== 变异验证(每份各改一个字节,期望全部 MISMATCH)===' : '=== 等价校验(期望全部 MATCH)===')
for (const [name, file, getCopy] of CASES) {
  let copyText = getCopy()
  if (mutate) {
    // 变异:把第一个出现的数字 +1(没有数字就改一个字母),模拟"手抄错一个字节"
    copyText = /\d/.test(copyText)
      ? copyText.replace(/\d/, (d) => String((Number(d) + 1) % 10))
      : copyText.replace(/[a-z]/, 'Z')
  }
  const copyCanon = JSON.stringify(JSON.parse(copyText))
  const fixCanon = JSON.stringify(JSON.parse(fixtureBody(file)))
  const d = firstDiff(copyCanon, fixCanon)
  const bytes = Buffer.byteLength(fixCanon, 'utf8')
  if (d === null) {
    console.log(`MATCH     ${name.padEnd(24)} ${bytes} bytes  <- ${file}`)
    if (mutate) bad++
  } else {
    console.log(`MISMATCH  ${name.padEnd(24)} ${d}`)
    if (!mutate) bad++
  }
}

console.log(
  mutate
    ? `---- 变异验证:${CASES.length - bad}/${CASES.length} 份被抓到(应为 ${CASES.length}/${CASES.length})`
    : `---- 等价校验:${CASES.length - bad}/${CASES.length} MATCH`,
)
process.exit(bad === 0 ? 0 : 1)
