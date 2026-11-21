import { createFileRoute } from "@tanstack/react-router";

import { GardenExperience } from "@/components/GardenExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Di Bawah Lengkungan Mawar — Taman 3D Interaktif" },
      {
        name: "description",
        content:
          "Jelajahi taman mawar 3D: pasangan di bangku kayu, kelinci, rusa, tupai, dan kupu-kupu yang terbang di antara kelopak.",
      },
      { property: "og:title", content: "Di Bawah Lengkungan Mawar — Taman 3D Interaktif" },
      {
        property: "og:description",
        content: "Taman mawar 3D interaktif dengan pasangan, hewan-hewan lucu, dan kupu-kupu yang bisa dipanggil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <GardenExperience />;
}
