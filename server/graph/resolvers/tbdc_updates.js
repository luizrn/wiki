const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

const DEFAULT_PUBLIC_HEADER = {
  title: 'Novidades TBDC',
  subtitle: 'Central pública de comunicados e atualizações',
  logoUrl: '/_assets/img/tbdc-agro-logo.png'
}

const DEFAULT_PUBLIC_FOOTER = {
  instagramText: 'Siga-nos no Instagram',
  instagramHandle: '@tbdcagro',
  instagramUrl: 'https://www.instagram.com/tbdcagro/',
  commercialPhone: '65 99623-2985',
  supportPhone: '65 99990-0123',
  addressLine1: 'Av. das Arapongas, 1104 N, Jardim das Orquídeas,',
  addressLine2: 'Nova Mutum - MT, 78452-006',
  mapUrl: 'https://maps.google.com/?q=Av.+das+Arapongas,+1104+Nova+Mutum+MT',
  privacyUrl: 'https://www.tbdc.com.br/',
  cookiesUrl: 'https://www.tbdc.com.br/',
  termsUrl: 'https://www.tbdc.com.br/',
  companyId: '© TBDC - 28.845.223/0001-79',
  socialInstagram: 'https://www.instagram.com/tbdcagro/',
  socialFacebook: 'https://www.facebook.com/',
  socialLinkedin: 'https://www.linkedin.com/',
  socialYoutube: 'https://www.youtube.com/'
}

async function upsertUpdateConfig (key, value) {
  const exists = await WIKI.models.knex('tbdc_update_config').where({ key }).first('key')
  if (exists) {
    await WIKI.models.knex('tbdc_update_config').where({ key }).update({ value: _.toString(value) })
  } else {
    await WIKI.models.knex('tbdc_update_config').insert({ key, value: _.toString(value) })
  }
}

module.exports = {
  Query: {
    async tbdcUpdates() { return {} }
  },
  Mutation: {
    async tbdcUpdates() { return {} }
  },
  TBDCUpdateQuery: {
    async listUpdates(obj, args) {
      const query = WIKI.models.tbdc.update.query()
        .withGraphJoined('[category, target]')
        .orderBy('publishedAt', 'DESC')
        .orderBy('createdAt', 'DESC')
      const countQuery = WIKI.models.tbdc.update.query()

      if (args.categoryId) {
        query.where('categoryId', args.categoryId)
        countQuery.where('categoryId', args.categoryId)
      }

      if (!args.isAdmin) {
        query.where('isPublished', true)
        countQuery.where('isPublished', true)
      }

      if (args.limit) {
        query.limit(args.limit)
      }
      if (args.offset) {
        query.offset(args.offset)
      }

      const items = await query
      const total = await countQuery.count('id as count').first()

      return {
        items,
        total: _.toSafeInteger(total.count)
      }
    },
    async getUpdate(obj, args) {
      return WIKI.models.tbdc.update.query().findById(args.id).withGraphJoined('[category, target]')
    },
    async adminConfig() {
      const config = await WIKI.models.knex('tbdc_update_config').select()
      const responsibleUserId = _.toSafeInteger(_.get(_.find(config, { key: 'responsibleUserId' }), 'value', 1))
      const conf = (key, fallback) => _.get(_.find(config, { key }), 'value', fallback)
      return {
        responsibleUserId: responsibleUserId > 0 ? responsibleUserId : 1,
        sidebarLinks: conf('sidebarLinks', '[]'),
        publicHeaderTitle: conf('publicHeaderTitle', DEFAULT_PUBLIC_HEADER.title),
        publicHeaderSubtitle: conf('publicHeaderSubtitle', DEFAULT_PUBLIC_HEADER.subtitle),
        publicHeaderLogoUrl: conf('publicHeaderLogoUrl', DEFAULT_PUBLIC_HEADER.logoUrl),
        publicFooterInstagramText: conf('publicFooterInstagramText', DEFAULT_PUBLIC_FOOTER.instagramText),
        publicFooterInstagramHandle: conf('publicFooterInstagramHandle', DEFAULT_PUBLIC_FOOTER.instagramHandle),
        publicFooterInstagramUrl: conf('publicFooterInstagramUrl', DEFAULT_PUBLIC_FOOTER.instagramUrl),
        publicFooterCommercialPhone: conf('publicFooterCommercialPhone', DEFAULT_PUBLIC_FOOTER.commercialPhone),
        publicFooterSupportPhone: conf('publicFooterSupportPhone', DEFAULT_PUBLIC_FOOTER.supportPhone),
        publicFooterAddressLine1: conf('publicFooterAddressLine1', DEFAULT_PUBLIC_FOOTER.addressLine1),
        publicFooterAddressLine2: conf('publicFooterAddressLine2', DEFAULT_PUBLIC_FOOTER.addressLine2),
        publicFooterMapUrl: conf('publicFooterMapUrl', DEFAULT_PUBLIC_FOOTER.mapUrl),
        publicFooterPrivacyUrl: conf('publicFooterPrivacyUrl', DEFAULT_PUBLIC_FOOTER.privacyUrl),
        publicFooterCookiesUrl: conf('publicFooterCookiesUrl', DEFAULT_PUBLIC_FOOTER.cookiesUrl),
        publicFooterTermsUrl: conf('publicFooterTermsUrl', DEFAULT_PUBLIC_FOOTER.termsUrl),
        publicFooterCompanyId: conf('publicFooterCompanyId', DEFAULT_PUBLIC_FOOTER.companyId),
        publicFooterSocialInstagram: conf('publicFooterSocialInstagram', DEFAULT_PUBLIC_FOOTER.socialInstagram),
        publicFooterSocialFacebook: conf('publicFooterSocialFacebook', DEFAULT_PUBLIC_FOOTER.socialFacebook),
        publicFooterSocialLinkedin: conf('publicFooterSocialLinkedin', DEFAULT_PUBLIC_FOOTER.socialLinkedin),
        publicFooterSocialYoutube: conf('publicFooterSocialYoutube', DEFAULT_PUBLIC_FOOTER.socialYoutube)
      }
    },
    async categories() {
      return WIKI.models.tbdc.update_category.query().orderBy('order', 'ASC')
    },
    async targets() {
      return WIKI.models.tbdc.update_target.query().orderBy('name', 'ASC')
    }
  },
  TBDCUpdateMutation: {
    async upsertUpdate(obj, args, context) {
      try {
        const updateData = {
          title: args.title,
          content: args.content,
          summary: args.summary,
          categoryId: args.categoryId,
          moduleId: args.moduleId,
          targetId: args.targetId,
          isPublished: args.isPublished,
          authorId: context.req.user.id
        }

        let update
        if (args.id) {
          update = await WIKI.models.tbdc.update.query().patchAndFetchById(args.id, updateData)
        } else {
          update = await WIKI.models.tbdc.update.query().insertAndFetch(updateData)
        }

        return {
          responseResult: graphHelper.generateSuccess('Update saved successfully.'),
          update
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deleteUpdate(obj, args) {
      try {
        await WIKI.models.tbdc.update.query().deleteById(args.id)
        return graphHelper.generateSuccess('Update deleted successfully.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async saveConfig(obj, args) {
      try {
        if (!_.isNil(args.responsibleUserId)) {
          await upsertUpdateConfig('responsibleUserId', args.responsibleUserId.toString())
        }
        if (!_.isNil(args.sidebarLinks)) {
          await upsertUpdateConfig('sidebarLinks', args.sidebarLinks)
        }
        if (!_.isNil(args.publicHeaderTitle)) {
          await upsertUpdateConfig('publicHeaderTitle', _.trim(args.publicHeaderTitle || DEFAULT_PUBLIC_HEADER.title))
        }
        if (!_.isNil(args.publicHeaderSubtitle)) {
          await upsertUpdateConfig('publicHeaderSubtitle', _.trim(args.publicHeaderSubtitle || DEFAULT_PUBLIC_HEADER.subtitle))
        }
        if (!_.isNil(args.publicHeaderLogoUrl)) {
          await upsertUpdateConfig('publicHeaderLogoUrl', _.trim(args.publicHeaderLogoUrl || DEFAULT_PUBLIC_HEADER.logoUrl))
        }
        if (!_.isNil(args.publicFooterInstagramText)) {
          await upsertUpdateConfig('publicFooterInstagramText', _.trim(args.publicFooterInstagramText || DEFAULT_PUBLIC_FOOTER.instagramText))
        }
        if (!_.isNil(args.publicFooterInstagramHandle)) {
          await upsertUpdateConfig('publicFooterInstagramHandle', _.trim(args.publicFooterInstagramHandle || DEFAULT_PUBLIC_FOOTER.instagramHandle))
        }
        if (!_.isNil(args.publicFooterInstagramUrl)) {
          await upsertUpdateConfig('publicFooterInstagramUrl', _.trim(args.publicFooterInstagramUrl || DEFAULT_PUBLIC_FOOTER.instagramUrl))
        }
        if (!_.isNil(args.publicFooterCommercialPhone)) {
          await upsertUpdateConfig('publicFooterCommercialPhone', _.trim(args.publicFooterCommercialPhone || DEFAULT_PUBLIC_FOOTER.commercialPhone))
        }
        if (!_.isNil(args.publicFooterSupportPhone)) {
          await upsertUpdateConfig('publicFooterSupportPhone', _.trim(args.publicFooterSupportPhone || DEFAULT_PUBLIC_FOOTER.supportPhone))
        }
        if (!_.isNil(args.publicFooterAddressLine1)) {
          await upsertUpdateConfig('publicFooterAddressLine1', _.trim(args.publicFooterAddressLine1 || DEFAULT_PUBLIC_FOOTER.addressLine1))
        }
        if (!_.isNil(args.publicFooterAddressLine2)) {
          await upsertUpdateConfig('publicFooterAddressLine2', _.trim(args.publicFooterAddressLine2 || DEFAULT_PUBLIC_FOOTER.addressLine2))
        }
        if (!_.isNil(args.publicFooterMapUrl)) {
          await upsertUpdateConfig('publicFooterMapUrl', _.trim(args.publicFooterMapUrl || DEFAULT_PUBLIC_FOOTER.mapUrl))
        }
        if (!_.isNil(args.publicFooterPrivacyUrl)) {
          await upsertUpdateConfig('publicFooterPrivacyUrl', _.trim(args.publicFooterPrivacyUrl || DEFAULT_PUBLIC_FOOTER.privacyUrl))
        }
        if (!_.isNil(args.publicFooterCookiesUrl)) {
          await upsertUpdateConfig('publicFooterCookiesUrl', _.trim(args.publicFooterCookiesUrl || DEFAULT_PUBLIC_FOOTER.cookiesUrl))
        }
        if (!_.isNil(args.publicFooterTermsUrl)) {
          await upsertUpdateConfig('publicFooterTermsUrl', _.trim(args.publicFooterTermsUrl || DEFAULT_PUBLIC_FOOTER.termsUrl))
        }
        if (!_.isNil(args.publicFooterCompanyId)) {
          await upsertUpdateConfig('publicFooterCompanyId', _.trim(args.publicFooterCompanyId || DEFAULT_PUBLIC_FOOTER.companyId))
        }
        if (!_.isNil(args.publicFooterSocialInstagram)) {
          await upsertUpdateConfig('publicFooterSocialInstagram', _.trim(args.publicFooterSocialInstagram || DEFAULT_PUBLIC_FOOTER.socialInstagram))
        }
        if (!_.isNil(args.publicFooterSocialFacebook)) {
          await upsertUpdateConfig('publicFooterSocialFacebook', _.trim(args.publicFooterSocialFacebook || DEFAULT_PUBLIC_FOOTER.socialFacebook))
        }
        if (!_.isNil(args.publicFooterSocialLinkedin)) {
          await upsertUpdateConfig('publicFooterSocialLinkedin', _.trim(args.publicFooterSocialLinkedin || DEFAULT_PUBLIC_FOOTER.socialLinkedin))
        }
        if (!_.isNil(args.publicFooterSocialYoutube)) {
          await upsertUpdateConfig('publicFooterSocialYoutube', _.trim(args.publicFooterSocialYoutube || DEFAULT_PUBLIC_FOOTER.socialYoutube))
        }
        return graphHelper.generateSuccess('Configuration saved successfully.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async upsertCategory(obj, args) {
      try {
        const payload = {
          name: _.trim(args.name),
          color: _.trim(args.color || '#18563B'),
          icon: _.trim(args.icon || 'mdi-tag'),
          showOnPublicPage: _.isBoolean(args.showOnPublicPage) ? args.showOnPublicPage : true,
          order: _.isInteger(args.order) ? args.order : 0
        }
        if (_.isEmpty(payload.name)) {
          throw new Error('Nome da categoria é obrigatório.')
        }
        if (args.id) {
          return WIKI.models.tbdc.update_category.query().patchAndFetchById(args.id, payload)
        }
        return WIKI.models.tbdc.update_category.query().insertAndFetch(payload)
      } catch (err) {
        throw err
      }
    },
    async deleteCategory(obj, args) {
      try {
        const inUse = await WIKI.models.tbdc.update.query().where('categoryId', args.id).count('id as total').first()
        if (_.toSafeInteger(_.get(inUse, 'total', 0)) > 0) {
          throw new Error('Não é possível excluir: categoria em uso por postagens.')
        }
        await WIKI.models.tbdc.update_category.query().deleteById(args.id)
        return graphHelper.generateSuccess('Categoria removida com sucesso.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async upsertTarget(obj, args) {
      try {
        const payload = {
          name: _.trim(args.name),
          icon: _.trim(args.icon || 'mdi-account-group')
        }
        if (_.isEmpty(payload.name)) {
          throw new Error('Nome do público-alvo é obrigatório.')
        }
        if (args.id) {
          return WIKI.models.tbdc.update_target.query().patchAndFetchById(args.id, payload)
        }
        return WIKI.models.tbdc.update_target.query().insertAndFetch(payload)
      } catch (err) {
        throw err
      }
    },
    async deleteTarget(obj, args) {
      try {
        const inUse = await WIKI.models.tbdc.update.query().where('targetId', args.id).count('id as total').first()
        if (_.toSafeInteger(_.get(inUse, 'total', 0)) > 0) {
          throw new Error('Não é possível excluir: público-alvo em uso por postagens.')
        }
        await WIKI.models.tbdc.update_target.query().deleteById(args.id)
        return graphHelper.generateSuccess('Público-alvo removido com sucesso.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async submitVote(obj, args, context) {
      try {
        await WIKI.models.tbdc.update_vote.query().insert({
          updateId: args.updateId,
          rating: args.rating,
          comment: args.comment,
          userId: context.req.user.id > 2 ? context.req.user.id : null
        })
        return graphHelper.generateSuccess('Vote submitted.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  TBDCUpdate: {
    async authorName(obj) {
      const author = await WIKI.models.users.query().findById(obj.authorId).select('name')
      return author ? author.name : 'Unknown'
    },
    async ratings(obj) {
      const votes = await WIKI.models.tbdc.update_vote.query().where('updateId', obj.id).select('rating')
      return {
        happy: _.filter(votes, { rating: 3 }).length,
        neutral: _.filter(votes, { rating: 2 }).length,
        sad: _.filter(votes, { rating: 1 }).length,
        total: votes.length
      }
    }
  }
}
