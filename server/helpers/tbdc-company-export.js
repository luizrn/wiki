const _ = require('lodash')
const sanitize = require('sanitize-filename')
const PDFDocument = require('pdfkit')
const PptxGenJS = require('pptxgenjs')

const PPTX_THEME = {
  bg: 'F3F8F4',
  dark: '18563B',
  accent: '9BC113',
  accentSoft: 'DCEBB0',
  text: '1F2D27',
  muted: 'CFE3D8',
  line: 'B8D3C5',
  panel: '1D6B49',
  white: 'FFFFFF'
}

function safeFilename (company, ext) {
  const base = sanitize(`permissoes-${company.id}-${company.name || 'empresa'}`.replace(/\s+/g, '-').toLowerCase())
  return `${base || `permissoes-${company.id}`}.${ext}`
}

function fmtDate (value) {
  if (!value) return '-'
  const dt = new Date(value)
  if (isNaN(dt.getTime())) return String(value)
  return dt.toLocaleString('pt-BR')
}

function asCsvValue (value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`
}

function generateCsv (company, permissions) {
  const rows = [
    ['Empresa', company.name],
    ['CS', _.get(company, 'cs.name', '')],
    ['Implantador', _.get(company, 'implantador.name', '')],
    ['Status', company.isActive ? 'Ativo' : 'Inativo'],
    ['Criado em', fmtDate(company.createdAt)],
    ['Atualizado em', fmtDate(company.updatedAt)],
    [],
    ['Produto', 'Modulo', 'Regra', 'Permissao', 'Descricao', 'Em vigor', 'Atualizado em']
  ]
  permissions.forEach(p => {
    rows.push([
      _.get(p, 'productName', ''),
      _.get(p, 'moduleName', ''),
      _.get(p, 'ruleName', ''),
      _.get(p, 'levelLabel', _.get(p, 'level', '')),
      _.get(p, 'description', ''),
      p.isActive ? 'SIM' : 'NAO',
      fmtDate(p.updatedAt)
    ])
  })
  const csv = rows.map(r => r.map(asCsvValue).join(',')).join('\n')
  return Buffer.from(csv, 'utf8')
}

async function generatePdf (company, permissions) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: 'A4' })
    const chunks = []
    doc.on('data', d => chunks.push(d))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fillColor('#18563B').fontSize(20).text(`Permissoes TBDC - ${company.name || 'Empresa'}`)
    doc.moveDown(0.6)
    doc.fontSize(10).fillColor('#333333')
    doc.text(`CS: ${_.get(company, 'cs.name', '-')}`)
    doc.text(`Implantador: ${_.get(company, 'implantador.name', '-')}`)
    doc.text(`Status: ${company.isActive ? 'Ativo' : 'Inativo'}`)
    doc.text(`Criado em: ${fmtDate(company.createdAt)}`)
    doc.text(`Atualizado em: ${fmtDate(company.updatedAt)}`)
    doc.moveDown(0.8)

    permissions.forEach((p, idx) => {
      if (idx > 0) doc.moveDown(0.25)
      doc.fontSize(11).fillColor('#18563B').text(`${_.get(p, 'productName', '-') } / ${_.get(p, 'moduleName', '-')}`)
      doc.fontSize(10).fillColor('#111111').text(`Regra: ${_.get(p, 'ruleName', '-')}`)
      doc.text(`Permissao: ${_.get(p, 'levelLabel', _.get(p, 'level', '-'))}`)
      doc.text(`Descricao: ${_.get(p, 'description', '-')}`)
      doc.text(`Em vigor: ${p.isActive ? 'SIM' : 'NAO'} | Atualizado: ${fmtDate(p.updatedAt)}`)
      if (doc.y > 760) doc.addPage()
    })
    doc.end()
  })
}

async function generatePptx (company, permissions) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'TBDC'
  pptx.company = 'TBDC'
  pptx.subject = company.name || 'Permissoes de Empresa'
  pptx.title = `Permissoes - ${company.name || 'Empresa'}`

  const cover = pptx.addSlide()
  cover.background = { color: PPTX_THEME.dark }
  cover.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.3, fill: { color: PPTX_THEME.accent }, line: { color: PPTX_THEME.accent } })
  cover.addText('TBDC', { x: 0.5, y: 0.18, w: 4, h: 0.6, color: PPTX_THEME.white, fontFace: 'Calibri', fontSize: 30, bold: true })
  cover.addText(company.name || 'Empresa', { x: 0.7, y: 1.8, w: 12, h: 1.2, color: PPTX_THEME.white, fontFace: 'Calibri', fontSize: 34, bold: true })
  cover.addText('Exportacao de permissoes cadastradas', { x: 0.7, y: 3.1, w: 11.8, h: 0.6, color: PPTX_THEME.muted, fontFace: 'Calibri', fontSize: 18 })
  cover.addText(`Gerado em: ${fmtDate(new Date().toISOString())}`, { x: 0.9, y: 4.1, w: 7.5, h: 0.5, color: PPTX_THEME.white, fontFace: 'Calibri', fontSize: 12 })

  const perSlide = 12
  for (let i = 0; i < permissions.length; i += perSlide) {
    const chunk = permissions.slice(i, i + perSlide)
    const slide = pptx.addSlide()
    slide.background = { color: PPTX_THEME.bg }
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.75, fill: { color: PPTX_THEME.dark }, line: { color: PPTX_THEME.dark } })
    slide.addText(`Permissoes - ${company.name || 'Empresa'}`, { x: 0.4, y: 0.18, w: 10.5, h: 0.3, color: PPTX_THEME.white, fontFace: 'Calibri', fontSize: 13, bold: true })

    let y = 1.0
    slide.addText('Produto | Modulo | Regra | Permissao | Descricao', { x: 0.4, y, w: 12.4, h: 0.3, color: PPTX_THEME.dark, fontFace: 'Calibri', fontSize: 10, bold: true })
    y += 0.35
    chunk.forEach(p => {
      const line = `${_.get(p, 'productName', '-') } | ${_.get(p, 'moduleName', '-') } | ${_.get(p, 'ruleName', '-') } | ${_.get(p, 'levelLabel', _.get(p, 'level', '-')) } | ${_.truncate(_.get(p, 'description', ''), { length: 85 })}`
      slide.addText(line, { x: 0.4, y, w: 12.4, h: 0.32, color: PPTX_THEME.text, fontFace: 'Calibri', fontSize: 9 })
      y += 0.35
    })
  }

  return pptx.write('nodebuffer')
}

async function generate (format, company, permissions) {
  switch (_.toLower(format || '')) {
    case 'csv':
      return {
        mime: 'text/csv; charset=utf-8',
        fileName: safeFilename(company, 'csv'),
        buffer: generateCsv(company, permissions)
      }
    case 'pdf':
      return {
        mime: 'application/pdf',
        fileName: safeFilename(company, 'pdf'),
        buffer: await generatePdf(company, permissions)
      }
    case 'pptx':
      return {
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileName: safeFilename(company, 'pptx'),
        buffer: await generatePptx(company, permissions)
      }
    default:
      throw new Error(`Formato de exportação não suportado: ${format}`)
  }
}

module.exports = {
  generate
}
