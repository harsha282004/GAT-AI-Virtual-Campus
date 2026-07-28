import {
  AIFeatures,
  CallToAction,
  CampusStatistics,
  Features,
  Hero,
  Testimonials,
  VirtualTourPreview,
  WhyChooseGAT,
} from "@/features/landing";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <CampusStatistics />
      <WhyChooseGAT />
      <AIFeatures />
      <VirtualTourPreview />
      <Testimonials />
      <CallToAction />
    </>
  );
}

