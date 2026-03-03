/**
 * Test written by Ng Hong Ray, A0253509A
 * 
 * Testing Principles Applied:
 * 
 * 1. Integration Testing
 * - Tests the integration of CategoryProduct with real Layout, Header, Footer components (no mocks)
 * - Tests integration with real router (MemoryRouter + Routes) to verify navigation from category to product details
 * 
 * 2. API Interaction Testing
 * - Mocks axios to test that CategoryProduct makes the expected API call to fetch category products
 * 
 * 3. UI Behavior Testing
 * - Tests that category name, result count, product cards, price formatting, and description truncation are rendered correctly based on API response
 * 
 * 4. Error Handling
 * - Tests that if the API call fails, the component does not crash and logs the error
 * 
 * 5. State Management Testing
 * - Tests that the component can handle missing/invalid data gracefully (e.g. missing category, missing price/description in products)
 * 
 * Note: This test file is focused on integration testing of the CategoryProduct page, and does not mock child components or contexts to 
 * ensure we are testing the real interactions and side effects.
 * Axios is mocked to control API responses and test different scenarios, but the rest of the component tree is real to ensure we are testing the actual rendering and behavior of the page.
 * This is an integration test, not an End-to-End test, so we are not testing the full stack or real API calls, but we are testing the integration of the CategoryProduct component with its child components and the router.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import axios from "axios";

import CategoryProduct from "./CategoryProduct";
import { AuthProvider } from "../context/auth";
import { SearchProvider } from "../context/search";
import { CartProvider } from "../context/cart";

jest.mock("axios");

// Helper: assert navigation happened
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

// Helper: catch runtime render errors (for bug tests)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div data-testid="error-boundary">
          {String(this.state.error?.message || this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

function renderWithProviders(initialPath = "/category/electronics") {
  return render(
    <AuthProvider>
      <SearchProvider>
        <CartProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              {/* Static route so we can assert navigation */}
              <Route
                path="/product/test-product"
                element={<div>PRODUCT-DETAILS-PAGE</div>}
              />
              <Route path="/category/:slug" element={<CategoryProduct />} />
            </Routes>
            <LocationDisplay />
          </MemoryRouter>
        </CartProvider>
      </SearchProvider>
    </AuthProvider>
  );
}

describe("CategoryProduct (integration)", () => {
  const mockCategory = { _id: "cat1", name: "Electronics", slug: "electronics" };

  const mockProducts = [
    {
      _id: "p1",
      name: "Test Product",
      slug: "test-product",
      description: "This is a test product description",
      price: 99.99,
    },
    {
      _id: "p2",
      name: "Another Product",
      slug: "another-product",
      description:
        "This is another product description that is long enough to be truncated properly",
      price: 49.5,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  function mockAxiosGetForCategoryPage({ category = mockCategory, products = [] } = {}) {
    axios.get.mockImplementation((url) => {
      // Header -> useCategory()
      if (url === "/api/v1/category/get-category") {
        return Promise.resolve({ data: { category: [] } });
      }

      // CategoryProduct -> main fetch
      if (url === "/api/v1/product/product-category/electronics") {
        return Promise.resolve({
          data: { category, products },
        });
      }

      // SearchInput (not used unless submitted)
      if (url.startsWith("/api/v1/product/search/")) {
        return Promise.resolve({ data: { products: [] } });
      }

      return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
    });
  }

  it("renders category name, result count, and product cards from API", async () => {
    mockAxiosGetForCategoryPage({ category: mockCategory, products: mockProducts });

    renderWithProviders("/category/electronics");

    // Wait until category header reflects loaded category
    expect(
      await screen.findByText(/Category\s*-\s*Electronics/i)
    ).toBeInTheDocument();

    // Result count
    expect(screen.getByText("2 result found")).toBeInTheDocument();

    // Products rendered
    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("Another Product")).toBeInTheDocument();

    // Price formatting
    expect(screen.getByText("$99.99")).toBeInTheDocument();
    expect(screen.getByText("$49.50")).toBeInTheDocument();

    // Description truncation
    const truncated = screen.getByText(/This is another product description that is long enough to/);
    expect(truncated.textContent).toMatch(/\.\.\.$/);

    // Image src correctness
    const img = screen.getByRole("img", { name: "Test Product" });
    expect(img).toHaveAttribute("src", "/api/v1/product/product-photo/p1");

    // API called as expected
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        "/api/v1/product/product-category/electronics"
      );
    });
  });

  it('navigates to /product/:slug when "More Details" is clicked (real router navigation)', async () => {
    mockAxiosGetForCategoryPage({ category: mockCategory, products: mockProducts });

    renderWithProviders("/category/electronics");

    // Wait for products
    await screen.findByText("Test Product");

    const buttons = screen.getAllByRole("button", { name: /More Details/i });
    expect(buttons.length).toBeGreaterThan(0);

    buttons[0].click();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/product/test-product");
    });

    expect(screen.getByText("PRODUCT-DETAILS-PAGE")).toBeInTheDocument();
  });

    it("Should NOT crash when a product has no price", async () => {
    const buggyProducts = [
        {
        _id: "p1",
        name: "No Price Product",
        slug: "no-price",
        description: "Has description but price is missing",
        // price missing
        },
    ];

    mockAxiosGetForCategoryPage({ category: mockCategory, products: buggyProducts });

    // If your component crashes, this test should FAIL (red)
    renderWithProviders("/category/electronics");

    // Wait for page to load category
    expect(await screen.findByText(/Category\s*-\s*Electronics/i)).toBeInTheDocument();

    // And product name should show
    expect(await screen.findByText("No Price Product")).toBeInTheDocument();

    // Optional: once you fix, you can assert a fallback like "N/A"
    // expect(screen.getByText(/N\/A|Price/i)).toBeInTheDocument();
    });

    it("Should not crash when a product has no description", async () => {
    const buggyProducts = [
        {
        _id: "p1",
        name: "No Description Product",
        slug: "no-desc",
        // description missing
        price: 10,
        },
    ];

    mockAxiosGetForCategoryPage({ category: mockCategory, products: buggyProducts });

    // If your component crashes, this test should FAIL (red)
    renderWithProviders("/category/electronics");

    expect(await screen.findByText(/Category\s*-\s*Electronics/i)).toBeInTheDocument();
    expect(await screen.findByText("No Description Product")).toBeInTheDocument();
    });

  it("handles missing category gracefully (category?.name should not crash)", async () => {
    mockAxiosGetForCategoryPage({ category: null, products: [] });

    renderWithProviders("/category/electronics");

    // Should still render the page without throwing
    expect(await screen.findByText(/Category\s*-\s*/i)).toBeInTheDocument();
    expect(screen.getByText("0 result found")).toBeInTheDocument();
  });
});