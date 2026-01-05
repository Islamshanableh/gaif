/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-param-reassign */
const cuid = require('cuid');
const httpStatus = require('http-status');
const { prisma } = require('./prisma.service');
const ApiError = require('../utils/ApiError');
const { uploadFile, deleteFile } = require('./common/aws.service');
const config = require('../config/config');

exports.createTicket = async payload => {
  const result = await prisma.ticket.create({
    data: {
      title: payload.title,
      fields: payload.fields,
      section: {
        connect: {
          id: payload.sectionId,
        },
      },
      userId: payload.userId,
      media: {
        create: payload?.files?.map(file => ({ link: file })),
      },
    },
  });

  return result;
};

const findArrayDifferences = (oldArr, newArr) => {
  const oldIds = oldArr.map(obj => obj.id);
  return newArr.filter(obj => !oldIds.includes(obj.id));
};

const findObjectDifferences = async (obj1, obj2) => {
  const differences = {};
  const differencesArray = [];

  for (const key in obj1) {
    if (obj1?.hasOwnProperty(key) && obj2?.hasOwnProperty(key)) {
      if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
        const arrayDifferences = await findArrayDifferences(
          obj1[key],
          obj2[key],
        );
        arrayDifferences?.map(item => {
          const newString = `Add ${item.value} to ${key} `;
          differencesArray.push(newString);
          return item;
        });
      } else if (
        typeof obj1[key] === 'object' &&
        typeof obj2[key] === 'object'
      ) {
        const nestedDifferences = await findObjectDifferences(
          obj1[key],
          obj2[key],
        );
        if (Object.keys(nestedDifferences).length > 0) {
          differences[key] = nestedDifferences;
          differencesArray.push(...nestedDifferences);
        }
      } else if (obj1[key] !== obj2[key]) {
        differences[key] = {
          oldValue: obj1[key],
          newValue: obj2[key],
        };
        const newString = `Change ${key} to ${obj2[key]}`;
        differencesArray.push(newString);
      }
    }
  }

  for (const key in obj2) {
    if (!obj1?.hasOwnProperty(key)) {
      differences[key] = {
        oldValue: 'new field added',
        newValue: obj2[key],
      };
      const newString = `Add value ${obj2[key]} to ${key}`;
      differencesArray.push(newString);
    }
  }

  return differencesArray;
};

exports.updateTicket = async (payload, userId) => {
  const findTicket = await prisma.ticket.findUnique({
    where: { id: payload?.id },
    include: {
      section: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
  if (!findTicket) {
    throw new ApiError(httpStatus.FORBIDDEN, 'ticket not found');
  }
  let differences = [];
  const findDifferences = await findObjectDifferences(
    findTicket.fields,
    payload.fields,
  );

  if (findDifferences.length > 0) {
    differences = findDifferences;
  }

  if (
    payload.sectionId &&
    Number(findTicket.sectionId) !== Number(payload?.sectionId || 0)
  ) {
    const findSection = await prisma.section.findUnique({
      where: {
        id: payload.sectionId,
      },
    });
    differences.changeSection = {
      oldSection: findTicket.section.title,
      newSection: findSection.title,
    };
    const newString = `Change section from  ${findTicket.section.title} to ${findSection.title}`;
    differences.push(newString);
  }

  if (payload?.files?.length) {
    payload?.files?.map(file => {
      const newString = `Add file : ${config.aws.prefix}${file}`;
      differences.push(newString);
      return file;
    });
  }

  if (payload.title && payload.title !== findTicket?.title) {
    const newString = `Change title of ticket to ${payload.title}`;
    differences.push(newString);
  }

  if (differences.length > 0) {
    await prisma.historyLog.create({
      data: {
        user: {
          connect: {
            id: userId,
          },
        },
        ticket: {
          connect: {
            id: payload.id,
          },
        },
        differences,
      },
    });
  }

  const result = await prisma.ticket.update({
    where: {
      id: payload.id,
    },
    data: {
      title: payload.title,
      fields: payload.fields,
      sectionId: payload.sectionId,
      userId: payload.userId,
      media: {
        create: payload?.files?.map(file => ({ link: file })),
      },
    },
  });

  return result;
};

exports.getTicketById = async id => {
  const result = await prisma.ticket.findUnique({
    where: {
      id,
    },
    include: {
      comment: {
        where: {
          isActive: true,
          isDeleted: false,
        },
      },
      media: {
        where: {
          isActive: true,
          isDeleted: false,
        },
      },
      historyLog: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      subTickets: {
        where: {
          isActive: true,
          isArchived: false,
        },
      },
    },
  });

  return result;
};

exports.deleteTicket = async id => {
  const result = await prisma.ticket.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return result;
};

exports.moveTickets = async payload => {
  const result = await prisma.ticket.updateMany({
    where: {
      id: { in: payload.ids },
    },
    data: {
      sectionId: payload.sectionId,
    },
  });

  return result;
};

exports.changeColorTickets = async payload => {
  const findTickets = await prisma.ticket.findMany({
    where: {
      id: { in: payload.ids },
    },
  });

  if (findTickets?.length) {
    for await (const ticket of findTickets) {
      ticket.fields.color = payload.color;
      await prisma.ticket.update({
        where: {
          id: ticket.id,
        },
        data: {
          fields: ticket.fields,
        },
      });
    }
  }
};

exports.uploadFiles = async files => {
  const ticketFiles = [];
  if (typeof files === 'object') {
    if (files?.files?.length) {
      await Promise.all(
        files?.files?.map(async file => {
          const fileName = `${cuid()}-${file.name}`;
          const upload = await uploadFile(
            file.data,
            `tickets/${fileName}`,
            file?.mimetype,
          );
          ticketFiles.push(upload?.Key);
        }),
      );
    } else {
      const fileName = `${cuid()}-${files?.files?.name}`;
      const upload = await uploadFile(
        files?.files?.data,
        `tickets/${fileName}`,
        files?.files?.mimetype,
      );
      ticketFiles.push(upload?.Key);
    }
  }

  return ticketFiles;
};

exports.deleteFile = async id => {
  const result = await prisma.media.update({
    where: {
      id,
    },
    data: {
      isActive: false,
      isDeleted: true,
    },
  });

  if (result?.link) {
    await deleteFile(result.link);
  }

  return result;
};

exports.createComment = async payload => {
  const result = await prisma.comment.create({
    data: {
      ...payload,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return result;
};

exports.canEditComment = async (userId, commentId) => {
  const commentDetails = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
  });

  return commentDetails?.userId === userId;
};

exports.updateComment = async payload => {
  const canUpdate = await this.canEditComment(
    payload.userId,
    payload.commentId,
  );

  if (canUpdate) {
    const comment = await prisma.comment.update({
      where: {
        id: payload.commentId,
      },
      data: {
        content: payload.content,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return comment;
  }
  throw new ApiError(httpStatus.FORBIDDEN, "you can't update this comment");
};

exports.deleteComment = async payload => {
  // const canUpdate = await this.canEditComment(
  //   payload.userId,
  //   payload.commentId,
  // );

  await prisma.comment.update({
    where: {
      id: payload.commentId,
    },
    data: {
      isActive: false,
      isDeleted: true,
    },
  });
};

exports.archivedTicket = async id => {
  const result = await prisma.ticket.update({
    where: {
      id,
    },
    data: {
      isArchived: true,
    },
  });

  return result;
};

exports.archivedMultiTickets = async ids => {
  const result = await prisma.ticket.updateMany({
    where: {
      id: {
        in: ids,
      },
    },
    data: {
      isArchived: true,
    },
  });

  return result;
};

// ==========================================================
// subTicket

exports.createSubTicket = async payload => {
  const result = await prisma.subTicket.create({
    data: {
      title: payload.title,
      fields: payload.fields,
      ticket: {
        connect: {
          id: payload.ticketId,
        },
      },
      userId: payload.userId,
      media: {
        create: payload?.files?.map(file => ({ link: file })),
      },
    },
  });

  return result;
};

exports.updateSubTicket = async (payload, userId) => {
  const findTicket = await prisma.subTicket.findUnique({
    where: { id: payload?.id },
  });
  if (!findTicket) {
    throw new ApiError(httpStatus.FORBIDDEN, 'sub ticket not found');
  }
  let differences = [];
  const findDifferences = await findObjectDifferences(
    findTicket.fields,
    payload.fields,
  );

  if (findDifferences.length > 0) {
    differences = findDifferences;
  }

  if (payload?.files?.length) {
    payload?.files?.map(file => {
      const newString = `Add file : ${config.aws.prefix}${file}`;
      differences.push(newString);
      return file;
    });
  }

  if (payload.title && payload.title !== findTicket?.title) {
    const newString = `Change title of ticket to ${payload.title}`;
    differences.push(newString);
  }

  if (differences.length > 0) {
    await prisma.historyLog.create({
      data: {
        user: {
          connect: {
            id: userId,
          },
        },
        ticket: {
          connect: {
            id: findTicket.ticketId,
          },
        },
        subTicket: {
          connect: {
            id: payload?.id,
          },
        },
        differences,
      },
    });
  }

  const result = await prisma.subTicket.update({
    where: {
      id: payload.id,
    },
    data: {
      title: payload.title,
      fields: payload.fields,
      ticketId: payload.ticketId,
      userId: payload.userId,
      media: {
        create: payload?.files?.map(file => ({ link: file })),
      },
    },
  });

  return result;
};

exports.getSubTicketById = async id => {
  const result = await prisma.subTicket.findUnique({
    where: {
      id,
    },
    include: {
      comment: {
        where: {
          isActive: true,
          isDeleted: false,
        },
      },
      media: {
        where: {
          isActive: true,
          isDeleted: false,
        },
      },
      historyLog: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return result;
};

exports.deleteSubTicket = async id => {
  const result = await prisma.subTicket.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return result;
};

exports.archivedSubTicket = async id => {
  const result = await prisma.subTicket.update({
    where: {
      id,
    },
    data: {
      isArchived: true,
    },
  });

  return result;
};
