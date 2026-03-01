/**
 * Bug fixed by: Ng Hong Ray, A0253509A
 * Bug Description:
 * 1. category should be an object, not []
 * 2. if price is missing
 * 3. if description is missing
 * 4. if API returns missing/invalid products
 * 
 * For the commented sections related to "ADD TO CART" button and pagination, these features were not fully implemented in the original code.
 * I do not see a neeed to add these features in the current scope of the CategoryProduct page, and they can be implemented in a future iteration if needed. 
 * The focus of this bug fix was to ensure that the existing features work correctly and do not crash when certain data is missing or malformed.
 */
import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/CategoryProductStyles.css";
import axios from "axios";
const CategoryProduct = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(null); // category should be an object, not an array

  useEffect(() => {
    if (params?.slug) getProductsByCat();
  }, [params?.slug]);
  const getProductsByCat = async () => {
    try {
      const { data } = await axios.get(
        `/api/v1/product/product-category/${params.slug}`
      );
      // FIX: guard against missing/non-array products
      setProducts(Array.isArray(data?.products) ? data.products : []);
      // FIX: guard category shape
      setCategory(data?.category ?? null);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Layout>
      <div className="container mt-3 category">
        <h4 className="text-center">Category - {category?.name}</h4>
        <h6 className="text-center">{products?.length} result found </h6>
        <div className="row">
          <div className="col-md-9 offset-1">
            <div className="d-flex flex-wrap">
              {products?.map((p) => (
                <div className="card m-2" key={p._id}>
                  <img
                    src={`/api/v1/product/product-photo/${p._id}`}
                    className="card-img-top"
                    alt={p.name}
                  />
                  <div className="card-body">
                    <div className="card-name-price">
                      <h5 className="card-title">{p.name}</h5>
                      <h5 className="card-title card-price">
                        {p?.price?.toLocaleString("en-US", { style: "currency", currency: "USD" }) ?? "N/A"} 
                        {/* FIX: handle missing price gracefully */}
                      </h5>
                    </div>
                    <p className="card-text ">
                      {(p?.description ?? "").substring(0, 60)}...
                      {/* FIX: handle missing description gracefully */}
                    </p>
                    <div className="card-name-price">
                      <button
                        className="btn btn-info ms-1"
                        onClick={() => navigate(`/product/${p.slug}`)}
                      >
                        More Details
                      </button>
                      {/* <button
                    className="btn btn-dark ms-1"
                    onClick={() => {
                      setCart([...cart, p]);
                      localStorage.setItem(
                        "cart",
                        JSON.stringify([...cart, p])
                      );
                      toast.success("Item Added to cart");
                    }}
                  >
                    ADD TO CART
                  </button> */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* <div className="m-2 p-3">
            {products && products.length < total && (
              <button
                className="btn btn-warning"
                onClick={(e) => {
                  e.preventDefault();
                  setPage(page + 1);
                }}
              >
                {loading ? "Loading ..." : "Loadmore"}
              </button>
            )}
          </div> */}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CategoryProduct;