import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, propertiesCol } from "@/lib/firestore/paths";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

type Props = {
  params: Promise<{ propertyId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function formatDate(v: unknown): string {
  if (v == null) return "—";
  const t = v as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toLocaleDateString();
  if (typeof t.seconds === "number")
    return new Date(t.seconds * 1000).toLocaleDateString();
  return String(v);
}

function AccessDeniedContent() {
  return (
    <>
      <PageHeader title="Property" />
      <Card className="p-6 max-w-md">
        <p className="font-medium text-zinc-900">You don&apos;t have access to this property.</p>
        <p className="mt-2 text-sm text-zinc-500">
          It may not be assigned to your account. Contact your agency if you believe this is an error.
        </p>
        <Link
          href="/landlord"
          className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Back to dashboard
        </Link>
      </Card>
    </>
  );
}

export default async function LandlordPropertyDetailPage({ params, searchParams }: Props) {
  const { propertyId } = await params;

  if (process.env.NODE_ENV !== "production" && searchParams) {
    const q = await searchParams;
    if (q?.diagnostic === "1") {
      return (
        <div className="p-6 font-mono text-sm">
          <p className="font-semibold text-zinc-900">[Diagnostic] Route hit</p>
          <p className="mt-2 text-zinc-600">params.propertyId = {propertyId}</p>
          <p className="mt-1 text-zinc-500">Remove ?diagnostic=1 to see the real page.</p>
        </div>
      );
    }
  }

  const session = await getServerSession();

  if (!session) redirect("/landlord/sign-in");

  const isLandlord = session.role === "landlord";
  const isSuperAdmin = session.role === "superAdmin";
  if (!isLandlord && !isSuperAdmin) redirect("/admin");

  const db = getAdminFirestore();
  const joinCol = db.collection(propertyLandlordsCol());

  let agencyId: string | null = null;

  if (isSuperAdmin) {
    const byProperty = await joinCol
      .where("propertyId", "==", propertyId)
      .limit(1)
      .get();
    const doc = byProperty.docs[0];
    if (!doc) return <AccessDeniedContent />;
    const d = doc.data();
    agencyId = typeof d.agencyId === "string" ? d.agencyId : null;
  } else {
    const byLandlord = await joinCol
      .where("landlordUid", "==", session.uid)
      .get();
    const match = byLandlord.docs.find((doc) => {
      const d = doc.data();
      const pid = typeof d.propertyId === "string" ? d.propertyId : "";
      const aid = typeof d.agencyId === "string" ? d.agencyId : "";
      if (pid !== propertyId) return false;
      if (
        session.agencyId != null &&
        session.agencyId !== "" &&
        session.agencyId !== aid
      )
        return false;
      return true;
    });
    if (!match) return <AccessDeniedContent />;
    const d = match.data();
    agencyId = typeof d.agencyId === "string" ? d.agencyId : null;
  }

  if (!agencyId) return <AccessDeniedContent />;

  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (!propSnap.exists) notFound();

  const p = propSnap.data()!;
  const title =
    typeof p.displayAddress === "string"
      ? p.displayAddress
      : typeof p.address === "string"
        ? p.address
        : typeof p.title === "string"
          ? p.title
          : "Property";
  const status = typeof p.status === "string" ? p.status : "—";
  const createdAt = p.createdAt;

  return (
    <>
      <PageHeader
        title={title}
        action={
          <Link
            href="/landlord"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Back to properties
          </Link>
        }
      />
      <Card className="p-6">
        <p className="font-medium text-zinc-900">{title}</p>
        <p className="text-sm text-zinc-500 mt-1">Status: {status}</p>
        <p className="text-sm text-zinc-500 mt-1">
          Created: {formatDate(createdAt)}
        </p>
      </Card>
    </>
  );
}
