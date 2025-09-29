import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const createTrainingMaterialSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['pdf', 'txt', 'manual']),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).optional(),
  priority: z.number().min(1).max(10).default(5),
  active: z.boolean().default(true),
  originalFileName: z.string().optional()
})

const updateTrainingMaterialSchema = createTrainingMaterialSchema.partial()

/**
 * GET /api/admin/training-materials
 * List training materials for AI coaching
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const whereClause: any = {}

    if (category) {
      whereClause.category = category
    }

    if (active !== null) {
      whereClause.active = active === 'true'
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ]
    }

    const trainingMaterials = await prisma.salesTrainingMaterial.findMany({
      where: whereClause,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset
    })

    const total = await prisma.salesTrainingMaterial.count({ where: whereClause })

    // Get categories for filtering
    const categories = await prisma.salesTrainingMaterial.groupBy({
      by: ['category'],
      where: { active: true },
      _count: {
        category: true
      },
      orderBy: {
        category: 'asc'
      }
    })

    return NextResponse.json({
      trainingMaterials,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      categories: categories.map(cat => ({
        name: cat.category,
        count: cat._count.category
      }))
    })

  } catch (error) {
    console.error('Get training materials error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training materials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/training-materials
 * Create new training material
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const materialData = createTrainingMaterialSchema.parse(body)

    // Create the training material
    const trainingMaterial = await prisma.salesTrainingMaterial.create({
      data: {
        ...materialData,
        uploadedById: user.id,
        tags: materialData.tags || []
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Log the creation
    await prisma.systemLog.create({
      data: {
        type: 'training_material_created',
        source: 'admin',
        message: `Training material "${trainingMaterial.title}" created`,
        data: {
          materialId: trainingMaterial.id,
          category: trainingMaterial.category,
          type: trainingMaterial.type,
          priority: trainingMaterial.priority,
          createdBy: user.id
        }
      }
    })

    return NextResponse.json({
      message: 'Training material created successfully',
      trainingMaterial
    }, { status: 201 })

  } catch (error) {
    console.error('Create training material error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid training material data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create training material' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/training-materials
 * Update training material
 */
export async function PUT(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Material ID is required' },
        { status: 400 }
      )
    }

    const updateData = updateTrainingMaterialSchema.parse(updates)

    // Check if material exists
    const existingMaterial = await prisma.salesTrainingMaterial.findUnique({
      where: { id }
    })

    if (!existingMaterial) {
      return NextResponse.json(
        { error: 'Training material not found' },
        { status: 404 }
      )
    }

    // Update the material
    const updatedMaterial = await prisma.salesTrainingMaterial.update({
      where: { id },
      data: updateData,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Log the update
    await prisma.systemLog.create({
      data: {
        type: 'training_material_updated',
        source: 'admin',
        message: `Training material "${updatedMaterial.title}" updated`,
        data: {
          materialId: id,
          updates: updateData,
          updatedBy: user.id
        }
      }
    })

    return NextResponse.json({
      message: 'Training material updated successfully',
      trainingMaterial: updatedMaterial
    })

  } catch (error) {
    console.error('Update training material error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid update data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update training material' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/training-materials
 * Delete training material
 */
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireAuth(req, [UserRole.ADMIN, UserRole.MANAGER])

  if (error) {
    return error
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Material ID is required' },
        { status: 400 }
      )
    }

    // Check if material exists
    const existingMaterial = await prisma.salesTrainingMaterial.findUnique({
      where: { id }
    })

    if (!existingMaterial) {
      return NextResponse.json(
        { error: 'Training material not found' },
        { status: 404 }
      )
    }

    // Delete the material
    await prisma.salesTrainingMaterial.delete({
      where: { id }
    })

    // Log the deletion
    await prisma.systemLog.create({
      data: {
        type: 'training_material_deleted',
        source: 'admin',
        message: `Training material "${existingMaterial.title}" deleted`,
        data: {
          materialId: id,
          title: existingMaterial.title,
          category: existingMaterial.category,
          deletedBy: user.id
        }
      }
    })

    return NextResponse.json({
      message: 'Training material deleted successfully'
    })

  } catch (error) {
    console.error('Delete training material error:', error)
    return NextResponse.json(
      { error: 'Failed to delete training material' },
      { status: 500 }
    )
  }
}