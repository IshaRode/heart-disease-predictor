import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heart Disease Risk Predictor | AI-Powered Cardiac Assessment",
  description:
    "An ML-powered heart disease risk prediction tool using the UCI Heart Disease dataset. Enter clinical data to receive instant risk assessment with explainable contributing factors.",
  keywords: [
    "heart disease prediction",
    "cardiac risk assessment",
    "machine learning",
    "UCI dataset",
    "medical AI",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
