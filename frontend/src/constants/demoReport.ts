import type { CreditReport } from '@/types';

/**
 * Pre-generated demo report based on Apple Inc.'s FY2024 Annual Report (10-K).
 * Loaded instantly without any API calls — used for portfolio demos.
 */
export const DEMO_REPORT: CreditReport = {
  companyName: 'Apple Inc.',
  generatedAt: '2024-11-01T00:00:00.000Z',

  overview: `## Company Overview

Apple Inc. is a global technology company headquartered in Cupertino, California, designing, manufacturing, and marketing consumer electronics, software, and services. The company operates through a tightly integrated hardware-software-services ecosystem that spans smartphones, personal computers, wearables, tablets, and a rapidly expanding digital services platform.

## Business Segments

- **iPhone** — The flagship product and primary revenue driver, generating approximately **$201.2 billion** in FY2024. Despite modest unit growth, average selling prices remain elevated due to the Pro and Pro Max lineup.
- **Mac** — Desktop and laptop computers powered by Apple Silicon (M-series chips), contributing **$29.9 billion**. The transition away from Intel is complete, delivering significant performance-per-watt improvements.
- **iPad** — Tablet segment generating **$26.7 billion**, with the iPad Pro featuring the M4 chip positioning Apple competitively against laptop-class devices.
- **Wearables, Home & Accessories** — AirPods, Apple Watch, HomePod, and accessories at **$37.0 billion**, though this segment has seen modest revenue pressure year-over-year.
- **Services** — The highest-margin segment at **$96.2 billion** (+13% YoY), encompassing the App Store, Apple Music, iCloud+, Apple TV+, Apple Arcade, Apple Pay, and AppleCare. Services now represent ~24% of total revenue.

## Strategic Positioning

Apple's competitive moat rests on deep vertical integration across silicon (Apple Silicon), software (iOS/macOS/watchOS), and services. The company's installed base exceeded **2.2 billion active devices** in 2024, providing a captive distribution channel for high-margin services. The introduction of Apple Intelligence (generative AI features) in iOS 18 and macOS Sequoia represents a significant platform investment aimed at differentiating hardware and driving upgrade cycles.`,

  financialHighlights: `## Revenue & Profitability

| Metric | FY2024 | FY2023 | YoY Change |
|--------|--------|--------|-----------|
| Total Revenue | $391.0B | $383.3B | +2.0% |
| Gross Profit | $180.7B | $169.1B | +6.9% |
| Gross Margin | 46.2% | 44.1% | +210 bps |
| Operating Income | $123.2B | $114.3B | +7.8% |
| Net Income | $93.7B | $97.0B | -3.4% |
| Diluted EPS | $6.08 | $6.13 | -0.8% |

## Key Financial Ratios

- **Return on Equity (ROE):** 157.4% — exceptionally high, reflecting aggressive share buybacks and negative book equity
- **Return on Assets (ROA):** 22.6%
- **Operating Margin:** 31.5%
- **Services Gross Margin:** ~74% vs. Products Gross Margin: ~37%

## Cash & Capital Returns

Apple generated **$108.8 billion** in operating cash flow in FY2024. The company returned **$94.9 billion** to shareholders:

- **$15.2B** in dividends
- **$79.7B** in share repurchases (reducing diluted share count by ~3.7% YoY)

Cash and marketable securities stood at **$153.2 billion**, with total debt of **$101.3 billion**, resulting in a net cash position of approximately **$51.9 billion**.

## Geographic Revenue

- Americas: $167.0B (43%)
- Europe: $101.3B (26%)
- Greater China: $74.6B (19%)
- Japan: $25.0B (6%)
- Rest of Asia Pacific: $30.7B (8%)

Greater China revenue declined ~1% YoY, reflecting heightened competition from domestic Android manufacturers (Huawei, Xiaomi) and macroeconomic softness.

~~~chartdata
{
  "charts": [
    {
      "type": "bar",
      "title": "Revenue Trend",
      "data": [{"name": "FY2023", "value": 383.3}, {"name": "FY2024", "value": 391.0}],
      "unit": "$B"
    },
    {
      "type": "pie",
      "title": "Revenue by Segment",
      "data": [{"name": "iPhone", "value": 201.2}, {"name": "Services", "value": 96.2}, {"name": "Wearables", "value": 37.0}, {"name": "Mac", "value": 29.9}, {"name": "iPad", "value": 26.7}],
      "unit": "$B"
    },
    {
      "type": "bar",
      "title": "Margin Analysis",
      "data": [{"name": "Gross", "value": 46.2}, {"name": "Operating", "value": 31.5}, {"name": "Services Gross", "value": 74.0}, {"name": "Products Gross", "value": 37.0}],
      "unit": "%"
    },
    {
      "type": "pie",
      "title": "Geographic Revenue",
      "data": [{"name": "Americas", "value": 167.0}, {"name": "Europe", "value": 101.3}, {"name": "Greater China", "value": 74.6}, {"name": "Japan", "value": 25.0}, {"name": "Rest of APAC", "value": 30.7}],
      "unit": "$B"
    }
  ]
}
~~~`,

  keyRisks: `## Macroeconomic & Geopolitical Risks

- **China dependency:** Apple manufactures the majority of its products in China through contract manufacturers (primarily Foxconn/Hon Hai). Escalating US-China trade tensions, potential tariffs, and export controls on semiconductors create meaningful supply chain exposure. Revenue from Greater China (~19% of total) is also at risk from consumer nationalism and regulatory pressure.
- **Currency headwinds:** With ~57% of revenue generated outside the US, a strong dollar creates persistent translation headwinds. Apple does not fully hedge its foreign currency exposure.

## Competitive Risks

- **Android ecosystem:** Samsung, Google Pixel, and Chinese OEMs (Huawei, Xiaomi, OPPO) continue to compete aggressively on price and feature parity, particularly in emerging markets.
- **AI platform competition:** Microsoft (Copilot), Google (Gemini), and Meta (Llama) are embedding generative AI deeply into their platforms. Apple Intelligence, while differentiated by on-device privacy, launched later and with fewer capabilities.
- **Regulatory pressure on App Store:** The EU's Digital Markets Act (DMA) requires Apple to allow alternative app stores and payment processors in Europe, threatening App Store gross margins. Similar legislation is advancing in the US, UK, and Japan.

## Legal & Regulatory Risks

- **DOJ antitrust lawsuit (March 2024):** The US Department of Justice filed a broad antitrust suit targeting iPhone ecosystem lock-in, iMessage exclusivity, Apple Watch compatibility, and App Store practices. An adverse ruling could require structural remedies.
- **Global minimum tax:** The OECD's 15% global minimum tax (Pillar Two) is being adopted across Apple's key jurisdictions, which may increase the company's effective tax rate from its historically low levels.

## Technology & Execution Risks

- **Apple Intelligence adoption:** AI features require iPhone 15 Pro or later (A17 Pro chip or newer), limiting the addressable base for a key upgrade catalyst in the near term.
- **Supply chain concentration:** Despite ongoing diversification to India and Vietnam, China still accounts for the vast majority of iPhone production, leaving Apple vulnerable to disruption.`,

  managementCommentary: `## CEO Tim Cook — Strategic Direction

Tim Cook highlighted the **Services growth trajectory** as the company's most important long-term value driver, noting that the segment now serves over **1 billion paid subscriptions** across its platform. Cook emphasized Apple Intelligence as a "once-in-a-generation" opportunity to redefine the smartphone, describing the on-device processing approach as a fundamental differentiator versus cloud-dependent competitors.

On manufacturing diversification, Cook confirmed Apple is "making great progress" expanding production in **India** (now producing iPhone 15 and iPhone 16 models) and **Vietnam** (AirPods, Apple Watch), while maintaining China as the primary production hub.

## CFO Luca Maestri — Capital Allocation

CFO Luca Maestri (transitioning to a broader role, succeeded by Kevan Parekh in January 2025) reaffirmed Apple's commitment to returning **100% of free cash flow** to shareholders over time. He noted the Board authorized an additional **$110 billion** in share repurchases in May 2024, the largest buyback authorization in Apple's history.

Maestri pointed to **gross margin expansion** as a key financial achievement, with the 46.2% blended margin exceeding guidance, driven by Services mix shift and favorable commodity pricing (NAND flash, DRAM).

## Forward Outlook

Management guided for **low-to-mid single digit revenue growth** in FY2025, with Services expected to continue outpacing Products. The company sees the iPhone 16 cycle — enhanced by Apple Intelligence availability — as a meaningful upgrade catalyst, particularly among users on iPhone 12 and older devices (estimated at ~40% of the installed base).

Capital expenditure is expected to remain in the **$9–11 billion** range annually, focused on data center infrastructure for Apple Intelligence and custom silicon R&D (Apple Silicon roadmap through M5/A19 generations).`,
};
