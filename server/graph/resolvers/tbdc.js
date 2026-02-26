const _ = require('lodash')

/* global WIKI */

function requireAuth (context) {
  const authUser = _.get(context, 'req.user') || _.get(context, 'user')
  if (!authUser || _.toSafeInteger(authUser.id) < 1) {
    throw new Error('Unauthorized')
  }
  return authUser
}

async function ensurePermissionLevelsTable () {
  const knex = WIKI.models.knex
  const hasTable = await knex.schema.hasTable('tbdc_permission_levels')
  if (!hasTable) {
    await knex.schema.createTable('tbdc_permission_levels', table => {
      table.increments('id').primary()
      table.string('code').notNullable().unique()
      table.string('label').notNullable()
      table.string('description')
      table.string('color').notNullable().defaultTo('#607D8B')
      table.integer('order').notNullable().defaultTo(0)
      table.boolean('isActive').notNullable().defaultTo(true)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
      table.index(['isActive', 'order'], 'tbdc_perm_levels_active_order_idx')
    })
  }

  const totalRow = await knex('tbdc_permission_levels').count('id as total').first()
  if (_.toSafeInteger(_.get(totalRow, 'total', 0)) < 1) {
    const now = new Date().toISOString()
    await knex('tbdc_permission_levels').insert([
      { code: 'GREEN', label: 'Suporte tem permissão', description: 'Suporte tem permissão', color: '#4CAF50', order: 10, isActive: true, createdAt: now, updatedAt: now },
      { code: 'BLUE', label: 'Sim, autorizado pelo focal', description: 'Sim, mas com autorização do focal', color: '#18563B', order: 20, isActive: true, createdAt: now, updatedAt: now },
      { code: 'PURPLE', label: 'Somente CS tem permissão', description: 'Somente o CS tem permissão', color: '#8E24AA', order: 30, isActive: true, createdAt: now, updatedAt: now },
      { code: 'YELLOW', label: 'Após consulta com CS', description: 'Somente após consulta com CS', color: '#7A980F', order: 40, isActive: true, createdAt: now, updatedAt: now },
      { code: 'ORANGE', label: 'Regra sobre parâmetro', description: 'Com alguma regra sobre algum parâmetro', color: '#9BC113', order: 50, isActive: true, createdAt: now, updatedAt: now },
      { code: 'RED', label: 'Não permitido', description: 'Não permitido ou não informado', color: '#F44336', order: 60, isActive: true, createdAt: now, updatedAt: now },
      { code: 'BLACK', label: 'Não utiliza', description: 'Não utiliza este produto', color: '#000000', order: 70, isActive: true, createdAt: now, updatedAt: now }
    ])
  }
}

async function ensureCompaniesAlihamentoColumn () {
  const knex = WIKI.models.knex
  const hasTable = await knex.schema.hasTable('tbdc_companies')
  if (!hasTable) {
    return
  }
  const hasColumn = await knex.schema.hasColumn('tbdc_companies', 'alihamento')
  if (!hasColumn) {
    await knex.schema.alterTable('tbdc_companies', table => {
      table.text('alihamento')
    })
  }
}

module.exports = {
  Query: {
    async tbdc () { return {} }
  },
  Mutation: {
    async tbdc () { return {} }
  },
  TBDCQuery: {
    async companies (obj, args, context) {
      requireAuth(context)
      await ensureCompaniesAlihamentoColumn()
      return WIKI.models.tbdc.company.query().orderBy('name')
    },
    async company (obj, args, context) {
      requireAuth(context)
      await ensureCompaniesAlihamentoColumn()
      return WIKI.models.tbdc.company.query().findById(args.id)
    },
    async products (obj, args, context) {
      requireAuth(context)
      return WIKI.models.tbdc.product.query().orderBy('name')
    },
    async staff (obj, args, context) {
      requireAuth(context)
      return WIKI.models.tbdc.staff.query().orderBy('name')
    },
    async permissionLevels (obj, args, context) {
      requireAuth(context)
      await ensurePermissionLevelsTable()
      return WIKI.models.tbdc.permission_level.query().orderBy('order', 'asc').orderBy('label', 'asc')
    }
  },
  TBDCMutation: {
    async saveCompany (obj, args, context) {
      requireAuth(context)
      await ensureCompaniesAlihamentoColumn()
      let company
      const companyPayload = _.omit(args, ['id', 'permissions'])
      const companyId = _.toSafeInteger(args.id)

      if (companyId > 0) {
        company = await WIKI.models.tbdc.company.query().patchAndFetchById(companyId, companyPayload)
      } else {
        company = await WIKI.models.tbdc.company.query().insertAndFetch(companyPayload)
      }

      if (args.permissions) {
        // Simple approach: delete existing and insert new
        await WIKI.models.tbdc.permission.query().where('companyId', company.id).delete()
        for (const perm of args.permissions) {
          const moduleId = _.toSafeInteger(perm.moduleId)
          if (moduleId < 1) {
            continue
          }
          await WIKI.models.tbdc.permission.query().insert({
            ..._.omit(perm, ['id']),
            moduleId,
            companyId: company.id
          })
        }
      }

      return company
    },
    async deleteCompany (obj, args, context) {
      requireAuth(context)
      await WIKI.models.tbdc.company.query().deleteById(args.id)
      return true
    },
    async saveProduct (obj, args) {
      if (args.id) {
        return WIKI.models.tbdc.product.query().patchAndFetchById(args.id, _.omit(args, ['id']))
      } else {
        return WIKI.models.tbdc.product.query().insertAndFetch(args)
      }
    },
    async deleteProduct (obj, args) {
      await WIKI.models.tbdc.product.query().deleteById(args.id)
      return true
    },
    async saveModule (obj, args) {
      if (args.id) {
        return WIKI.models.tbdc.module.query().patchAndFetchById(args.id, _.omit(args, ['id']))
      } else {
        return WIKI.models.tbdc.module.query().insertAndFetch(args)
      }
    },
    async deleteModule (obj, args) {
      await WIKI.models.tbdc.module.query().deleteById(args.id)
      return true
    },
    async saveStaff (obj, args) {
      if (args.id) {
        return WIKI.models.tbdc.staff.query().patchAndFetchById(args.id, _.omit(args, ['id']))
      } else {
        return WIKI.models.tbdc.staff.query().insertAndFetch(args)
      }
    },
    async deleteStaff (obj, args) {
      await WIKI.models.tbdc.staff.query().deleteById(args.id)
      return true
    },
    async savePermissionLevel (obj, args) {
      await ensurePermissionLevelsTable()
      const payload = {
        code: _.toUpper(_.trim(args.code || '')),
        label: _.trim(args.label || ''),
        description: _.trim(args.description || ''),
        color: _.trim(args.color || '#607D8B'),
        order: _.toSafeInteger(args.order) || 0,
        isActive: _.isBoolean(args.isActive) ? args.isActive : true
      }

      if (!payload.code || !payload.label) {
        throw new Error('Código e label são obrigatórios.')
      }

      if (args.id) {
        return WIKI.models.tbdc.permission_level.query().patchAndFetchById(args.id, payload)
      } else {
        return WIKI.models.tbdc.permission_level.query().insertAndFetch(payload)
      }
    },
    async deletePermissionLevel (obj, args) {
      await ensurePermissionLevelsTable()
      const level = await WIKI.models.tbdc.permission_level.query().findById(args.id)
      if (!level) {
        return true
      }

      const inUse = await WIKI.models.tbdc.permission.query()
        .where('level', level.code)
        .count('id as total')
        .first()
      if (_.toSafeInteger(_.get(inUse, 'total', 0)) > 0) {
        throw new Error('Este tipo de permissão já está em uso e não pode ser excluído.')
      }

      await WIKI.models.tbdc.permission_level.query().deleteById(args.id)
      return true
    }
  },
  TBDCCompany: {
    cs (company) {
      return (company.csId) ? WIKI.models.tbdc.staff.query().findById(company.csId) : null
    },
    implantador (company) {
      return (company.implantadorId) ? WIKI.models.tbdc.staff.query().findById(company.implantadorId) : null
    },
    permissions (company) {
      return WIKI.models.tbdc.permission.query().where('companyId', company.id)
    }
  },
  TBDCProduct: {
    modules (product) {
      return WIKI.models.tbdc.module.query().where('productId', product.id)
    }
  },
  TBDCModule: {
    product (module) {
      return WIKI.models.tbdc.product.query().findById(module.productId)
    }
  },
  TBDCPermission: {
    module (permission) {
      return WIKI.models.tbdc.module.query().findById(permission.moduleId)
    }
  }
}
