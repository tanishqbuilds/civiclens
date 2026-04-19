const Joi = require('joi');

const postTicketSchema = Joi.object({
    description: Joi.string().max(500).allow('', null).optional(),
    photoUrl: Joi.string().uri().optional(),
    longitude: Joi.number().min(-180).max(180).required(),
    latitude: Joi.number().min(-90).max(90).required(),
}).options({ allowUnknown: true }); // allow multipart fields

const patchTicketSchema = Joi.object({
    status: Joi.string().valid('open', 'in_progress', 'resolved').required(),
});

function validatePostTicket(req, res, next) {
    // For multipart requests body fields are strings — coerce them
    const payload = {
        ...req.body,
        longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : undefined,
        latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : undefined,
    };

    const { error } = postTicketSchema.validate(payload, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details.map((d) => d.message).join('; '),
        });
    }

    next();
}

function validatePatchTicket(req, res, next) {
    const { error } = patchTicketSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details.map((d) => d.message).join('; '),
        });
    }

    next();
}

module.exports = { validatePostTicket, validatePatchTicket };
