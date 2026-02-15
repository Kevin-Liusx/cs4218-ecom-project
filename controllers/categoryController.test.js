
import { jest } from "@jest/globals";

// 1) Mock slugify (ESM-safe)
jest.unstable_mockModule("slugify", () => ({
    default: jest.fn((s) => `slug-${String(s)}`),
}));

// 2) Mock categoryModel as BOTH:
//    - constructor function (new categoryModel(...).save())
//    - static methods (findOne, find, etc.)
const categoryModelFn = jest.fn();
categoryModelFn.findOne = jest.fn();
categoryModelFn.find = jest.fn();
categoryModelFn.findByIdAndUpdate = jest.fn();
categoryModelFn.findByIdAndDelete = jest.fn();

jest.unstable_mockModule("../models/categoryModel.js", () => ({
    default: categoryModelFn,
}));

// 3) Import AFTER mocks
const { default: slugify } = await import("slugify");
const { default: categoryModel } = await import("../models/categoryModel.js");
const controllers = await import("./categoryController.js"); // adjust path if needed

const {
    createCategoryController,
    updateCategoryController,
    categoryControlller,
    singleCategoryController,
    deleteCategoryCOntroller,
} = controllers;

const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};

describe("Category Controllers (EP/BVA + isolation) [ESM]", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        slugify.mockImplementation((s) => `slug-${String(s)}`);
    });

    describe("createCategoryController", () => {
        test("BVA: missing name -> 401 (Name is required)", async () => {
            const req = { body: {} };
            const res = makeRes();

            await createCategoryController(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
        });

        test("BVA: empty string name -> 401 (Name is required)", async () => {
            const req = { body: { name: "" } };
            const res = makeRes();

            await createCategoryController(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
        });

        test("EP: existing category -> 200 (Category Already Exisits)", async () => {
            const req = { body: { name: "Books" } };
            const res = makeRes();

            categoryModel.findOne.mockResolvedValueOnce({ _id: "x", name: "Books" });

            await createCategoryController(req, res);

            expect(categoryModel.findOne).toHaveBeenCalledWith({ name: "Books" });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Category Already Exisits",
            });
        });

        test("EP: new category -> 201 with saved category", async () => {
            const req = { body: { name: "Electronics" } };
            const res = makeRes();

            categoryModel.findOne.mockResolvedValueOnce(null);

            const savedDoc = {
                _id: "1",
                name: "Electronics",
                slug: "slug-Electronics",
            };
            const saveMock = jest.fn().mockResolvedValueOnce(savedDoc);

            // constructor returns instance with save()
            categoryModel.mockImplementationOnce(() => ({ save: saveMock }));

            await createCategoryController(req, res);

            expect(slugify).toHaveBeenCalledWith("Electronics");
            expect(categoryModel).toHaveBeenCalledWith({
                name: "Electronics",
                slug: "slug-Electronics",
            });
            expect(saveMock).toHaveBeenCalledTimes(1);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "new category created",
                category: savedDoc,
            });
        });

        test("EP: createCategoryController DB failure -> 500 + logs error", async () => {
            const req = { body: { name: "Toys" } };
            const res = makeRes();

            const logSpy = jest.spyOn(console, "log").mockImplementation(() => { });
            categoryModel.findOne.mockRejectedValueOnce(new Error("db down"));

            await createCategoryController(req, res);

            expect(logSpy).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Error in Category",
                    error: expect.objectContaining({ message: "db down" }),
                })
            );

            logSpy.mockRestore();
        });

    });

    describe("updateCategoryController", () => {
        test("EP: valid update -> 200 + updated category", async () => {
            const req = { body: { name: "NewName" }, params: { id: "123" } };
            const res = makeRes();

            const updated = { _id: "123", name: "NewName", slug: "slug-NewName" };
            categoryModel.findByIdAndUpdate.mockResolvedValueOnce(updated);

            await updateCategoryController(req, res);

            expect(slugify).toHaveBeenCalledWith("NewName");
            expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "123",
                { name: "NewName", slug: "slug-NewName" },
                { new: true }
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                messsage: "Category Updated Successfully",
                category: updated,
            });
        });

        test("Error-path: update throws -> 500", async () => {
            const req = { body: { name: "X" }, params: { id: "123" } };
            const res = makeRes();

            categoryModel.findByIdAndUpdate.mockRejectedValueOnce(new Error("fail"));

            await updateCategoryController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Error while updating category",
                })
            );
        });
    });

    describe("categoryControlller (get all)", () => {
        test("EP: returns all categories -> 200", async () => {
            const req = {};
            const res = makeRes();

            const list = [{ _id: "1" }, { _id: "2" }];
            categoryModel.find.mockResolvedValueOnce(list);

            await categoryControlller(req, res);

            expect(categoryModel.find).toHaveBeenCalledWith({});
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "All Categories List",
                category: list,
            });
        });

        test("Error-path: find throws -> 500", async () => {
            const req = {};
            const res = makeRes();

            categoryModel.find.mockRejectedValueOnce(new Error("fail"));

            await categoryControlller(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Error while getting all categories",
                })
            );
        });
    });

    describe("singleCategoryController", () => {
        test("EP: slug exists -> 200 + category", async () => {
            const req = { params: { slug: "books" } };
            const res = makeRes();

            const cat = { _id: "1", slug: "books" };
            categoryModel.findOne.mockResolvedValueOnce(cat);

            await singleCategoryController(req, res);

            expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "books" });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Get SIngle Category SUccessfully",
                category: cat,
            });
        });

        test("Error-path: findOne throws -> 500", async () => {
            const req = { params: { slug: "x" } };
            const res = makeRes();

            categoryModel.findOne.mockRejectedValueOnce(new Error("fail"));

            await singleCategoryController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Error While getting Single Category",
                })
            );
        });
    });

    describe("deleteCategoryCOntroller", () => {
        test("EP: valid delete -> 200", async () => {
            const req = { params: { id: "123" } };
            const res = makeRes();

            categoryModel.findByIdAndDelete.mockResolvedValueOnce({ _id: "123" });

            await deleteCategoryCOntroller(req, res);

            expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("123");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Categry Deleted Successfully",
            });
        });

        test("Error-path: delete throws -> 500", async () => {
            const req = { params: { id: "123" } };
            const res = makeRes();

            categoryModel.findByIdAndDelete.mockRejectedValueOnce(new Error("fail"));

            await deleteCategoryCOntroller(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "error while deleting category",
                })
            );
        });
    });
});
