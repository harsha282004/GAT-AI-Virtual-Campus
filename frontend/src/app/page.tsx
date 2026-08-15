import {
  CallToAction,
  CampusShowcase,
  CampusStatistics,
  Features,
  Hero,
  LeadershipSection,
  Testimonials,
  WhyChooseGAT,
} from "@/features/landing";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <CampusStatistics />
      <WhyChooseGAT />
      <LeadershipSection />
      <CampusShowcase />
      <Testimonials />
      <CallToAction />
    </>
  );
}

