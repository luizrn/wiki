const { nanoid } = require('nanoid')

/* global WIKI */

module.exports = {
  Query: {
    publicLinks: () => ({})
  },
  Mutation: {
    publicLinks: () => ({})
  },
  PublicLinksQuery: {
    async list(obj, args, context) {
      let query = WIKI.models.pagePublicLinks.query().withGraphFetched('[page, creator, approver]')
      if (args.status) {
        query = query.where('status', args.status)
      }
      return query.orderBy('createdAt', 'desc')
    },
    async single(obj, args, context) {
      return WIKI.models.pagePublicLinks.query().findOne('token', args.token).withGraphFetched('[page, creator, approver]')
    },
    async byPage(obj, args, context) {
      return WIKI.models.pagePublicLinks.query().where('pageId', args.pageId).withGraphFetched('[page, creator, approver]')
    }
  },
  PublicLinksMutation: {
    async request(obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().findById(args.pageId)
        if (!page) {
          throw new Error('Page not found')
        }

        // Check if user has write access to the page
        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          locale: page.localeCode,
          path: page.path
        })) {
          throw new Error('Forbidden')
        }

        // Generate a random token
        const token = nanoid(32)

        const link = await WIKI.models.pagePublicLinks.query().insert({
          pageId: args.pageId,
          token,
          status: 'PENDING',
          createdById: context.req.user.id
        })

        return {
          responseResult: {
            succeeded: true,
            message: 'Public link requested and pending approval.'
          },
          link
        }
      } catch (err) {
        return {
          responseResult: {
            succeeded: false,
            message: err.message
          }
        }
      }
    },
    async approve(obj, args, context) {
      try {
        await WIKI.models.pagePublicLinks.query().patch({
          status: 'APPROVED',
          approvedById: context.req.user.id
        }).findById(args.id)

        return {
          succeeded: true,
          message: 'Public link approved.'
        }
      } catch (err) {
        return {
          succeeded: false,
          message: err.message
        }
      }
    },
    async reject(obj, args, context) {
      try {
        await WIKI.models.pagePublicLinks.query().patch({
          status: 'REJECTED'
        }).findById(args.id)

        return {
          succeeded: true,
          message: 'Public link rejected.'
        }
      } catch (err) {
        return {
          succeeded: false,
          message: err.message
        }
      }
    },
    async revoke(obj, args, context) {
      try {
        await WIKI.models.pagePublicLinks.query().patch({
          status: 'EXPIRED'
        }).findById(args.id)

        return {
          succeeded: true,
          message: 'Public link revoked.'
        }
      } catch (err) {
        return {
          succeeded: false,
          message: err.message
        }
      }
    }
  }
}
