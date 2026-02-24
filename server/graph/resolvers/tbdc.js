const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async tbdc () { return {} }
  },
  Mutation: {
    async tbdc () { return {} }
  },
  TBDCQuery: {
    async companies () {
      return WIKI.models.tbdc.company.query().orderBy('name')
    },
    async company (obj, args) {
      return WIKI.models.tbdc.company.query().findById(args.id)
    },
    async products () {
      return WIKI.models.tbdc.product.query().orderBy('name')
    },
    async staff () {
      return WIKI.models.tbdc.staff.query().orderBy('name')
    }
  },
  TBDCMutation: {
    async saveCompany (obj, args) {
      let company
      if (args.id) {
        company = await WIKI.models.tbdc.company.query().patchAndFetchById(args.id, _.omit(args, ['id', 'permissions']))
      } else {
        company = await WIKI.models.tbdc.company.query().insertAndFetch(_.omit(args, ['permissions']))
      }

      if (args.permissions) {
        // Simple approach: delete existing and insert new
        await WIKI.models.tbdc.permission.query().where('companyId', company.id).delete()
        for (const perm of args.permissions) {
          await WIKI.models.tbdc.permission.query().insert({
            ...perm,
            companyId: company.id
          })
        }
      }

      return company
    },
    async deleteCompany (obj, args) {
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
