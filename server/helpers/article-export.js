const _ = require('lodash')
const path = require('path')
const fs = require('fs-extra')
const sanitize = require('sanitize-filename')
const PDFDocument = require('pdfkit')
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx')
const ExcelJS = require('exceljs')
const PptxGenJS = require('pptxgenjs')
const removeMd = require('remove-markdown')
const cheerio = require('cheerio')

const FOOTER_TEXT = 'TODOS OS CONTEÚDOS SÃO RESTRITO - CONFIDÊNCIAL - USO INTERNO DA TBDC🔴'
const PPTX_THEME = {
  bg: 'F4F6FA',
  dark: '0E1A2B',
  accent: 'D32F2F',
  accentSoft: 'FFCDD2',
  text: '263238',
  white: 'FFFFFF'
}
const PPTX_FONT_TITLE = 'Calibri'
const PPTX_FONT_BODY = 'Calibri'

function safeFilename (page, ext) {
  const base = sanitize(`${page.localeCode}-${page.path}`.replace(/[\\/]/g, '-')) || `article-${page.id}`
  return `${base}.${ext}`
}

function normalizeText (txt) {
  return String(txt || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+$/gm, '')
    .trim()
}

function getArticlePlainText (page) {
  if (page.contentType === 'html') {
    return normalizeText(removeMd(require('striptags')(page.content || '')))
  }
  return normalizeText(removeMd(page.content || ''))
}

function extractSections (page) {
  const titleFallback = page.title || 'Artigo'
  const sections = []

  if (page.contentType === 'html') {
    const $ = cheerio.load(page.content || '')
    let current = { title: titleFallback, lines: [] }
    $('h1,h2,h3,h4,h5,h6,p,li').each((idx, el) => {
      const tag = String(el.tagName || '').toLowerCase()
      const text = normalizeText($(el).text())
      if (!text) return
      if (tag.startsWith('h')) {
        if (current.lines.length > 0 || current.title !== titleFallback) {
          sections.push(current)
        }
        current = { title: text, lines: [] }
      } else {
        current.lines.push(text)
      }
    })
    if (current.lines.length > 0 || sections.length < 1) {
      sections.push(current)
    }
    return sections
  }

  const lines = String(page.content || '').split('\n')
  let current = { title: titleFallback, lines: [] }
  for (const raw of lines) {
    const ln = raw.trim()
    if (!ln) continue
    const heading = ln.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      if (current.lines.length > 0 || current.title !== titleFallback) {
        sections.push(current)
      }
      current = { title: normalizeText(removeMd(heading[1])), lines: [] }
    } else {
      current.lines.push(normalizeText(removeMd(ln)))
    }
  }
  if (current.lines.length > 0 || sections.length < 1) {
    sections.push(current)
  }
  return sections
}

function resolveBrandLogo () {
  const candidates = []
  if (process.env.TBDC_EXPORT_LOGO) {
    candidates.push(process.env.TBDC_EXPORT_LOGO)
  }
  const cfgLogo = _.get(global, 'WIKI.config.logoUrl', '')
  if (_.isString(cfgLogo) && cfgLogo.length > 1) {
    if (cfgLogo.startsWith('/_assets/')) {
      const localRel = cfgLogo.replace('/_assets/', '')
      candidates.push(path.resolve(_.get(global, 'WIKI.ROOTPATH', process.cwd()), 'assets', localRel))
    } else if (cfgLogo.startsWith('/')) {
      candidates.push(path.resolve(_.get(global, 'WIKI.ROOTPATH', process.cwd()), cfgLogo.slice(1)))
    } else if (!cfgLogo.startsWith('http')) {
      candidates.push(path.resolve(_.get(global, 'WIKI.ROOTPATH', process.cwd()), cfgLogo))
    }
  }
  candidates.push(path.resolve(_.get(global, 'WIKI.ROOTPATH', process.cwd()), 'data', 'tbdc', 'logo.png'))
  candidates.push(path.resolve(_.get(global, 'WIKI.ROOTPATH', process.cwd()), 'data', 'tbdc', 'logo.jpg'))

  for (const c of candidates) {
    try {
      if (c && fs.pathExistsSync(c)) {
        return c
      }
    } catch (err) {}
  }
  return null
}

function buildCorporateCoverBackgroundDataUri () {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0E1A2B"/>
      <stop offset="100%" stop-color="#1A2D4A"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D32F2F" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#9A2020" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect x="0" y="0" width="1600" height="120" fill="url(#accent)"/>
  <circle cx="1320" cy="640" r="280" fill="#FFFFFF" fill-opacity="0.04"/>
  <circle cx="1420" cy="720" r="180" fill="#FFFFFF" fill-opacity="0.05"/>
  <path d="M0,760 C420,640 940,860 1600,700 L1600,900 L0,900 Z" fill="#D32F2F" fill-opacity="0.16"/>
  <path d="M0,810 C500,690 1020,910 1600,760 L1600,900 L0,900 Z" fill="#FFFFFF" fill-opacity="0.06"/>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function addBrandLogo (slide, logoPathOrData, opts = {}) {
  if (!logoPathOrData) {
    return false
  }
  try {
    const baseOpts = {
      x: opts.x || 0.42,
      y: opts.y || 0.11,
      w: opts.w || 1.32,
      h: opts.h || 0.55
    }
    if (_.startsWith(logoPathOrData, 'data:')) {
      slide.addImage({ data: logoPathOrData, ...baseOpts })
    } else {
      slide.addImage({ path: logoPathOrData, ...baseOpts })
    }
    return true
  } catch (err) {
    return false
  }
}

function slideFooter (slide) {
  slide.addShape('rect', {
    x: 0,
    y: 6.9,
    w: 13.33,
    h: 0.6,
    fill: { color: PPTX_THEME.dark },
    line: { color: PPTX_THEME.dark }
  })
  slide.addText(FOOTER_TEXT, {
    x: 0.3,
    y: 7.05,
    w: 9.8,
    h: 0.3,
    fontFace: PPTX_FONT_BODY,
    color: PPTX_THEME.white,
    fontSize: 8.5,
    align: 'left'
  })
}

function buildPptxVersion (page) {
  const stamp = String(page.updatedAt || page.createdAt || new Date().toISOString()).slice(0, 16).replace('T', ' ')
  return `DOC-${page.id}-${String(page.localeCode || 'xx').toUpperCase()} | v${stamp}`
}

function applyCorporateMaster (slide, { title, subtitle, pageNo, totalSlides, version, isCover = false, brandLogo }) {
  if (!isCover) {
    slide.background = { color: PPTX_THEME.bg }
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.82, fill: { color: PPTX_THEME.dark }, line: { color: PPTX_THEME.dark } })
    const hasLogo = addBrandLogo(slide, brandLogo)
    if (!hasLogo) {
      slide.addText('TBDC', {
        x: 0.45,
        y: 0.13,
        w: 1.4,
        h: 0.36,
        color: PPTX_THEME.white,
        fontFace: PPTX_FONT_TITLE,
        fontSize: 18,
        bold: true
      })
    }
    slide.addText(title || 'Apresentacao', {
      x: 1.9,
      y: 0.16,
      w: 8.4,
      h: 0.32,
      color: PPTX_THEME.white,
      fontFace: PPTX_FONT_TITLE,
      fontSize: 14,
      bold: true
    })
    if (subtitle) {
      slide.addText(subtitle, {
        x: 1.9,
        y: 0.42,
        w: 8.2,
        h: 0.2,
        color: 'C7D3E4',
        fontFace: PPTX_FONT_BODY,
        fontSize: 9
      })
    }
  }

  slideFooter(slide)
  slide.addText(version, {
    x: 9.9,
    y: 7.02,
    w: 2.3,
    h: 0.18,
    color: PPTX_THEME.accentSoft,
    fontFace: PPTX_FONT_BODY,
    fontSize: 7.5,
    align: 'right'
  })
  slide.addText(`${pageNo}/${totalSlides}`, {
    x: 12.25,
    y: 7.02,
    w: 0.8,
    h: 0.18,
    color: PPTX_THEME.white,
    fontFace: PPTX_FONT_BODY,
    fontSize: 9,
    bold: true,
    align: 'right'
  })
}

async function generatePdf (page) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' })
  const chunks = []
  doc.on('data', c => chunks.push(c))

  const writeFooter = () => {
    doc.fontSize(8).fillColor('#666666')
    doc.text(FOOTER_TEXT, 48, doc.page.height - 46, { width: doc.page.width - 96, align: 'center' })
  }
  doc.on('pageAdded', writeFooter)

  doc.rect(0, 0, doc.page.width, 130).fill('#0B3D91')
  doc.fillColor('#FFFFFF').fontSize(30).text('TBDC', 48, 38)
  doc.fontSize(12).text('Apresentacao de Conteudo Interno', 48, 82)
  doc.moveDown(2)

  doc.fillColor('#111111').fontSize(22).text(page.title || 'Artigo', { width: 500 })
  doc.moveDown(0.5)
  doc.fontSize(11).fillColor('#333333')
  doc.text(`Criado em: ${page.createdAt || '-'}`)
  doc.text(`Atualizado em: ${page.updatedAt || '-'}`)
  doc.text(`Criador: ${page.creatorName || '-'}`)
  doc.text(`Ultima alteracao por: ${page.authorName || '-'}`)
  doc.moveDown(1.2)

  doc.fillColor('#222222').fontSize(12)
  getArticlePlainText(page).split('\n').forEach(ln => {
    if (ln.trim()) {
      doc.text(ln, { width: 500 })
    }
  })
  writeFooter()
  doc.end()
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

async function generateCsv (page) {
  const body = getArticlePlainText(page).replace(/"/g, '""')
  const rows = [
    ['Campo', 'Valor'],
    ['Titulo', page.title || ''],
    ['Caminho', `/${page.localeCode}/${page.path}`],
    ['CriadoEm', page.createdAt || ''],
    ['AtualizadoEm', page.updatedAt || ''],
    ['Criador', page.creatorName || ''],
    ['UltimaAlteracaoPor', page.authorName || ''],
    ['Conteudo', body],
    ['Aviso', FOOTER_TEXT]
  ]
  const csv = rows.map(r => `"${String(r[0]).replace(/"/g, '""')}","${String(r[1]).replace(/"/g, '""')}"`).join('\n')
  return Buffer.from(csv, 'utf8')
}

async function generateXlsx (page) {
  const wb = new ExcelJS.Workbook()
  const meta = wb.addWorksheet('Resumo')
  meta.columns = [{ header: 'Campo', key: 'field', width: 26 }, { header: 'Valor', key: 'value', width: 90 }]
  meta.addRows([
    { field: 'Titulo', value: page.title || '' },
    { field: 'Caminho', value: `/${page.localeCode}/${page.path}` },
    { field: 'CriadoEm', value: page.createdAt || '' },
    { field: 'AtualizadoEm', value: page.updatedAt || '' },
    { field: 'Criador', value: page.creatorName || '' },
    { field: 'UltimaAlteracaoPor', value: page.authorName || '' },
    { field: 'Aviso', value: FOOTER_TEXT }
  ])
  meta.getRow(1).font = { bold: true }

  const content = wb.addWorksheet('Conteudo')
  content.columns = [{ header: 'Linha', key: 'lineNo', width: 10 }, { header: 'Texto', key: 'text', width: 120 }]
  const lines = getArticlePlainText(page).split('\n').filter(Boolean)
  lines.forEach((ln, i) => content.addRow({ lineNo: i + 1, text: ln }))
  content.getRow(1).font = { bold: true }

  return wb.xlsx.writeBuffer()
}

async function generateDocx (page) {
  const children = [
    new Paragraph({
      text: 'TBDC',
      heading: HeadingLevel.TITLE
    }),
    new Paragraph({
      children: [new TextRun({ text: page.title || 'Artigo', bold: true, size: 38 })]
    }),
    new Paragraph(`Criado em: ${page.createdAt || '-'}`),
    new Paragraph(`Atualizado em: ${page.updatedAt || '-'}`),
    new Paragraph(`Criador: ${page.creatorName || '-'}`),
    new Paragraph(`Ultima alteracao por: ${page.authorName || '-'}`),
    new Paragraph('')
  ]

  getArticlePlainText(page).split('\n').forEach(ln => {
    if (ln.trim()) {
      children.push(new Paragraph(ln))
    }
  })

  children.push(new Paragraph(''))
  children.push(new Paragraph({
    children: [new TextRun({ text: FOOTER_TEXT, bold: true })]
  }))

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  })
  return Packer.toBuffer(doc)
}

async function generatePptx (page) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'TBDC'
  pptx.company = 'TBDC'
  pptx.subject = page.title || 'Artigo'
  pptx.title = `Apresentacao - ${page.title || 'Artigo'}`
  pptx.theme = {
    headFontFace: PPTX_FONT_TITLE,
    bodyFontFace: PPTX_FONT_BODY,
    lang: 'pt-BR'
  }

  const brandLogoPath = resolveBrandLogo()
  const version = buildPptxVersion(page)
  const sectionSlides = []
  const sections = extractSections(page)
  sections.forEach(sec => {
    const blocks = _.chunk(sec.lines, 8)
    if (blocks.length < 1) {
      blocks.push([])
    }
    blocks.forEach((chunkLines, idx) => {
      sectionSlides.push({
        title: sec.title || page.title || 'Secao',
        chunkLines,
        idx
      })
    })
  })
  const totalSlides = 2 + sectionSlides.length

  const cover = pptx.addSlide()
  cover.background = { color: PPTX_THEME.dark }
  addBrandLogo(cover, buildCorporateCoverBackgroundDataUri(), { x: 0, y: 0, w: 13.33, h: 7.5 })
  cover.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.3, fill: { color: PPTX_THEME.accent }, line: { color: PPTX_THEME.accent } })
  cover.addShape('line', { x: 0, y: 1.31, w: 13.33, h: 0, line: { color: 'FFFFFF', pt: 0.7, transparency: 25 } })
  const hasCoverLogo = addBrandLogo(cover, brandLogoPath, { x: 0.5, y: 0.16, w: 2.0, h: 0.68 })
  if (!hasCoverLogo) {
    cover.addText('TBDC', { x: 0.5, y: 0.18, w: 4, h: 0.6, color: PPTX_THEME.white, fontFace: PPTX_FONT_TITLE, fontSize: 30, bold: true })
  }
  cover.addText(page.title || 'Artigo', { x: 0.7, y: 1.8, w: 12, h: 1.2, color: PPTX_THEME.white, fontFace: PPTX_FONT_TITLE, fontSize: 34, bold: true })
  cover.addText('Apresentacao automatica do artigo', { x: 0.7, y: 3.1, w: 11.8, h: 0.6, color: 'DCE3EE', fontFace: PPTX_FONT_BODY, fontSize: 18 })
  cover.addText(`Criado em: ${page.createdAt || '-'}\nAtualizado em: ${page.updatedAt || '-'}\nCriador: ${page.creatorName || '-'}\nUltima alteracao por: ${page.authorName || '-'}`, {
    x: 0.9, y: 4.1, w: 7.5, h: 2.0, color: PPTX_THEME.white, fontFace: PPTX_FONT_BODY, fontSize: 14, valign: 'top'
  })
  cover.addShape('rect', { x: 9.2, y: 3.7, w: 3.2, h: 2.3, fill: { color: '1E2A3D' }, line: { color: PPTX_THEME.accent, pt: 1.2 } })
  cover.addText(`/${page.localeCode}/${page.path}`, { x: 9.35, y: 4.5, w: 2.9, h: 1.0, color: PPTX_THEME.white, fontFace: 'Consolas', fontSize: 11, align: 'center', valign: 'mid' })
  cover.addText(version, {
    x: 0.85,
    y: 6.45,
    w: 4.8,
    h: 0.2,
    color: PPTX_THEME.accentSoft,
    fontFace: PPTX_FONT_BODY,
    fontSize: 9
  })
  applyCorporateMaster(cover, {
    title: page.title || 'Artigo',
    subtitle: 'Capa',
    pageNo: 1,
    totalSlides,
    version,
    isCover: true,
    brandLogo: brandLogoPath
  })

  const summary = pptx.addSlide()
  applyCorporateMaster(summary, {
    title: page.title || 'Artigo',
    subtitle: 'Sumario',
    pageNo: 2,
    totalSlides,
    version,
    brandLogo: brandLogoPath
  })
  summary.addShape('roundRect', {
    x: 0.85,
    y: 1.2,
    w: 11.8,
    h: 5.45,
    fill: { color: 'FFFFFF' },
    line: { color: 'DCE3EE', pt: 1 },
    radius: 0.1
  })
  summary.addText('Sumario', {
    x: 1.15,
    y: 1.45,
    w: 8,
    h: 0.35,
    color: PPTX_THEME.dark,
    fontFace: PPTX_FONT_TITLE,
    fontSize: 24,
    bold: true
  })
  const uniqueSections = _.uniq(sectionSlides.map(s => s.title)).slice(0, 18)
  const summaryLines = uniqueSections.length > 0 ?
    uniqueSections.map((s, i) => `${String(i + 1).padStart(2, '0')}. ${s}`).join('\n') :
    '01. Conteudo do artigo'
  summary.addText(summaryLines, {
    x: 1.2,
    y: 2.0,
    w: 11.0,
    h: 4.3,
    color: PPTX_THEME.text,
    fontFace: PPTX_FONT_BODY,
    fontSize: 17,
    breakLine: true
  })

  sectionSlides.forEach((sec, index) => {
    const slide = pptx.addSlide()
    const subtitle = sec.idx > 0 ? `Continua (${sec.idx + 1})` : `Sessao ${index + 1}`
    applyCorporateMaster(slide, {
      title: sec.title,
      subtitle,
      pageNo: index + 3,
      totalSlides,
      version,
      brandLogo: brandLogoPath
    })

    if (sec.idx > 0) {
      slide.addText(`Continua (${sec.idx + 1})`, {
        x: 11.0,
        y: 0.19,
        w: 2.0,
        h: 0.28,
        color: PPTX_THEME.accentSoft,
        fontFace: PPTX_FONT_BODY,
        fontSize: 10,
        align: 'right'
      })
    }

    const bulletText = sec.chunkLines.length > 0 ?
      sec.chunkLines.map(l => `• ${l}`).join('\n') :
      '• (Sem conteudo textual nesta secao)'

    slide.addShape('roundRect', {
      x: 0.7,
      y: 1.2,
      w: 11.95,
      h: 5.5,
      fill: { color: 'FFFFFF' },
      line: { color: 'DCE3EE', pt: 1 },
      radius: 0.1
    })
    slide.addShape('rect', {
      x: 0.7,
      y: 1.2,
      w: 0.13,
      h: 5.5,
      fill: { color: PPTX_THEME.accent },
      line: { color: PPTX_THEME.accent }
    })
    slide.addText(bulletText, {
      x: 1.0,
      y: 1.45,
      w: 11.45,
      h: 4.95,
      color: PPTX_THEME.text,
      fontFace: PPTX_FONT_BODY,
      fontSize: 18,
      valign: 'top',
      breakLine: true
    })
  })

  return pptx.write('nodebuffer')
}

async function generate (format, page) {
  const fmt = _.toLower(format)
  switch (fmt) {
    case 'pdf':
      return {
        mime: 'application/pdf',
        fileName: safeFilename(page, 'pdf'),
        buffer: await generatePdf(page)
      }
    case 'csv':
      return {
        mime: 'text/csv; charset=utf-8',
        fileName: safeFilename(page, 'csv'),
        buffer: await generateCsv(page)
      }
    case 'xlsx':
    case 'slsx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: safeFilename(page, 'xlsx'),
        buffer: await generateXlsx(page)
      }
    case 'docx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: safeFilename(page, 'docx'),
        buffer: await generateDocx(page)
      }
    case 'pptx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileName: safeFilename(page, 'pptx'),
        buffer: await generatePptx(page)
      }
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

module.exports = {
  FOOTER_TEXT,
  generate
}
