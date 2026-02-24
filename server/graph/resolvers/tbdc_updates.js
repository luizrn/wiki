const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async tbdcUpdates() { return {} }
  },
  Mutation: {
    async tbdcUpdates() { return {} }
  },
  TBDCUpdateQuery: {
    async listUpdates(obj, args) {
      const query = WIKI.models.tbdcUpdates.query()
        .withGraphJoined('[category, target]')
        .orderBy('publishedAt', 'DESC')
        .orderBy('createdAt', 'DESC')
      const countQuery = WIKI.models.tbdcUpdates.query()

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
      return WIKI.models.tbdcUpdates.query().findById(args.id).withGraphJoined('[category, target]')
    },
    async adminConfig() {
      const config = await WIKI.models.knex('tbdc_update_config').select()
      const responsibleUserId = _.toSafeInteger(_.get(_.find(config, { key: 'responsibleUserId' }), 'value', 1))
      return {
        responsibleUserId: responsibleUserId > 0 ? responsibleUserId : 1,
        sidebarLinks: _.get(_.find(config, { key: 'sidebarLinks' }), 'value', '[]')
      }
    },
    async categories() {
      return WIKI.models.tbdcUpdateCategories.query().orderBy('order', 'ASC')
    },
    async targets() {
      return WIKI.models.tbdcUpdateTargets.query().orderBy('name', 'ASC')
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
          update = await WIKI.models.tbdcUpdates.query().patchAndFetchById(args.id, updateData)
        } else {
          update = await WIKI.models.tbdcUpdates.query().insertAndFetch(updateData)
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
        await WIKI.models.tbdcUpdates.query().deleteById(args.id)
        return graphHelper.generateSuccess('Update deleted successfully.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async saveConfig(obj, args) {
      try {
        if (!_.isNil(args.responsibleUserId)) {
          await WIKI.models.knex('tbdc_update_config').where('key', 'responsibleUserId').update({ value: args.responsibleUserId.toString() })
        }
        if (!_.isNil(args.sidebarLinks)) {
          await WIKI.models.knex('tbdc_update_config').where('key', 'sidebarLinks').update({ value: args.sidebarLinks })
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
          return WIKI.models.tbdcUpdateCategories.query().patchAndFetchById(args.id, payload)
        }
        return WIKI.models.tbdcUpdateCategories.query().insertAndFetch(payload)
      } catch (err) {
        throw err
      }
    },
    async deleteCategory(obj, args) {
      try {
        const inUse = await WIKI.models.tbdcUpdates.query().where('categoryId', args.id).count('id as total').first()
        if (_.toSafeInteger(_.get(inUse, 'total', 0)) > 0) {
          throw new Error('Não é possível excluir: categoria em uso por postagens.')
        }
        await WIKI.models.tbdcUpdateCategories.query().deleteById(args.id)
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
          return WIKI.models.tbdcUpdateTargets.query().patchAndFetchById(args.id, payload)
        }
        return WIKI.models.tbdcUpdateTargets.query().insertAndFetch(payload)
      } catch (err) {
        throw err
      }
    },
    async deleteTarget(obj, args) {
      try {
        const inUse = await WIKI.models.tbdcUpdates.query().where('targetId', args.id).count('id as total').first()
        if (_.toSafeInteger(_.get(inUse, 'total', 0)) > 0) {
          throw new Error('Não é possível excluir: público-alvo em uso por postagens.')
        }
        await WIKI.models.tbdcUpdateTargets.query().deleteById(args.id)
        return graphHelper.generateSuccess('Público-alvo removido com sucesso.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async submitVote(obj, args, context) {
      try {
        await WIKI.models.tbdcUpdateVotes.query().insert({
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
      const votes = await WIKI.models.tbdcUpdateVotes.query().where('updateId', obj.id).select('rating')
      return {
        happy: _.filter(votes, { rating: 3 }).length,
        neutral: _.filter(votes, { rating: 2 }).length,
        sad: _.filter(votes, { rating: 1 }).length,
        total: votes.length
      }
    }
  }
}
