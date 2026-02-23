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

      if (args.categoryId) {
        query.where('categoryId', args.categoryId)
      }

      if (!args.isAdmin) {
        query.where('isPublished', true)
      }

      if (args.limit) {
        query.limit(args.limit)
      }
      if (args.offset) {
        query.offset(args.offset)
      }

      const items = await query
      const total = await WIKI.models.tbdcUpdates.query().count('id as count').first()

      return {
        items,
        total: total.count
      }
    },
    async getUpdate(obj, args) {
      return WIKI.models.tbdcUpdates.query().findById(args.id).withGraphJoined('[category, target]')
    },
    async adminConfig() {
      const config = await WIKI.models.knex('tbdc_update_config').select()
      return {
        responsibleUserId: _.get(_.find(config, { key: 'responsibleUserId' }), 'value', 1),
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
        if (args.responsibleUserId) {
          await WIKI.models.knex('tbdc_update_config').where('key', 'responsibleUserId').update({ value: args.responsibleUserId.toString() })
        }
        if (args.sidebarLinks) {
          await WIKI.models.knex('tbdc_update_config').where('key', 'sidebarLinks').update({ value: args.sidebarLinks })
        }
        return graphHelper.generateSuccess('Configuration saved successfully.')
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
