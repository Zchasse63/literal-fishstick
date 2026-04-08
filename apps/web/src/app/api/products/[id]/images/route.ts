import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STORAGE_BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * GET /api/products/[id]/images
 * List images for a product.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: productId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId = profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Read from the products table images array
    const { data: product, error } = await supabase
      .from("products")
      .select("id, images")
      .eq("id", productId)
      .eq("studio_id", studioId)
      .single();

    if (error) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ data: product.images ?? [] });
  } catch (err) {
    console.error("GET /api/products/[id]/images error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/images
 * Upload an image for a product using Supabase Storage.
 * Content-Type: multipart/form-data
 * Fields: file (File), alt_text? (string), is_primary? (boolean)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: productId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, images")
      .eq("id", productId)
      .eq("studio_id", studioId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const altText = formData.get("alt_text") as string | null;
    const isPrimary = formData.get("is_primary") === "true";

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${studioId}/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;

    // Update the product's images array
    const currentImages: string[] = product.images ?? [];
    const updatedImages = isPrimary
      ? [imageUrl, ...currentImages]
      : [...currentImages, imageUrl];

    const { error: updateError } = await supabase
      .from("products")
      .update({ images: updatedImages, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("studio_id", studioId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "product_image_uploaded",
      subject_type: "product",
      subject_id: productId,
      metadata: { image_url: imageUrl, alt_text: altText, is_primary: isPrimary },
    });

    return NextResponse.json(
      {
        data: {
          image_url: imageUrl,
          alt_text: altText,
          is_primary: isPrimary,
          product_id: productId,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/products/[id]/images error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
