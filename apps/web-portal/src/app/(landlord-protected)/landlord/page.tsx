import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LandlordDashboardProperties } from "./LandlordDashboardProperties";

type Assignment = {
  agencyId: string;
  propertyId: string;
  createdAtMs: number | null;
};

type PropertyData = {
  id: string;
  agencyId: string;
  title: string;
  postcode: string;
  status: string;
  createdAtMs: number | null;
};

export default async function LandlordDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/landlord/sign-in");

  const isLandlord = session.role === "landlord";
  const isSuperAdmin = session.role === "superAdmin";
  if (!isLandlord && !isSuperAdmin) redirect("/admin");

  // Landlord portal stays landlord-scoped by default (even for superAdmin). No
  // "view all" mode; superAdmin can use the API with ?landlordUid= for other users.
  const landlordUid = session.uid;

  const db = getAdminFirestore();
  const joinCol = db.collection(propertyLandlordsCol());
  // Order by createdAt desc; Firestore may require composite index (landlordUid asc, createdAt desc).
  const joinQuery = joinCol
    .where("landlordUid", "==", landlordUid)
    .orderBy("createdAt", "desc");
  const joinSnap = await joinQuery.get();

  const assignments: Assignment[] = [];
  joinSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.status === "removed") return;
    const agencyId = typeof d.agencyId === "string" ? d.agencyId : "";
    const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
    if (agencyId && propertyId) {
      if (
        session.agencyId != null &&
        session.agencyId !== "" &&
        session.agencyId !== agencyId
      )
        return;
      assignments.push({
        agencyId,
        propertyId,
        createdAtMs: serializeTimestamp(d.createdAt),
      });
    }
  });

  type AssignmentWithProperty = { assignment: Assignment; property: PropertyData };
  const list: AssignmentWithProperty[] = [];

  await Promise.all(
    assignments.map(async (assignment) => {
      const { agencyId, propertyId } = assignment;
      const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
      const propSnap = await propRef.get();
      if (!propSnap.exists) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[Landlord dashboard] propertyLandlords points to missing property: agencyId=${agencyId} propertyId=${propertyId}`
          );
        }
        return;
      }
      const p = propSnap.data()!;
      const title =
        typeof p.displayAddress === "string"
          ? p.displayAddress
          : typeof p.address === "string"
            ? p.address
            : typeof p.title === "string"
              ? p.title
              : "Property";
      list.push({
        assignment: {
          ...assignment,
          createdAtMs: assignment.createdAtMs,
        },
        property: {
          id: propertyId,
          agencyId,
          title,
          postcode: typeof p.postcode === "string" ? p.postcode : "",
          status: typeof p.status === "string" ? p.status : "—",
          createdAtMs: serializeTimestamp(p.createdAt),
        },
      });
    })
  );

  list.sort((a, b) => {
    const aMs = a.property.createdAtMs ?? 0;
    const bMs = b.property.createdAtMs ?? 0;
    return bMs - aMs;
  });

  // Ensure only plain, serializable values are passed to the client component
  const serializedList = list.map((item) => ({
    assignment: {
      agencyId: item.assignment.agencyId,
      propertyId: item.assignment.propertyId,
      createdAtMs: item.assignment.createdAtMs,
    },
    property: {
      id: item.property.id,
      agencyId: item.property.agencyId,
      title: item.property.title,
      postcode: item.property.postcode,
      status: item.property.status,
      createdAtMs: item.property.createdAtMs,
    },
  }));

  const displayName = session.email ?? "Landlord";

  return (
    <>
      <PageHeader title="Dashboard" />
      <p className="text-sm text-zinc-500 mb-4">Your properties</p>
      {list.length === 0 ? (
        <EmptyState
          title="No properties assigned yet"
          description="Properties linked to your account will appear here."
        />
      ) : (
        <LandlordDashboardProperties list={serializedList} />
      )}
      <Card className="p-6 mt-6">
        <p className="text-lg font-medium text-zinc-900">Welcome, {displayName}</p>
        <p className="mt-2 text-sm text-zinc-500">
          Your properties will appear above when assigned by your agency.
        </p>
      </Card>
    </>
  );
}
