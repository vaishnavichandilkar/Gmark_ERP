import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ArrowLeft, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { translateDynamic } from "../../../../utils/i18nUtils";
import productService from "../../../../services/productService";
import toast from "react-hot-toast";

const CustomSelect = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  isSearchable = false,
  disabled = false,
  showAsterisk = false,
  getOptionLabel,
  footerLabel = "",
  onFooterClick = null,
  error = "",
}) => {
  const { t } = useTranslation(["common"]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const filteredOptions =
    isSearchable && searchTerm
      ? options.filter((opt) => {
        const label = getOptionLabel ? getOptionLabel(opt) : opt;
        return label?.toLowerCase().includes(searchTerm.toLowerCase());
      })
      : options;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = value
    ? getOptionLabel
      ? getOptionLabel(value)
      : value
    : "";

  return (
    <div className="flex flex-col gap-1.5 relative w-full" ref={dropdownRef}>
      <label className="text-[13px] font-semibold text-[#4B5563]">
        {label} {showAsterisk && <span className="text-red-500">*</span>}
      </label>
      <div
        className={`w-full h-[44px] flex items-center justify-between px-4 border rounded-[8px] bg-white transition-colors ${disabled ? "cursor-not-allowed border-[#E5E7EB] bg-gray-50" : error ? "border-red-500 ring-1 ring-red-500/10 cursor-pointer" : isOpen ? "border-[#014A36] ring-1 ring-[#014A36]/10 cursor-pointer" : "border-[#E5E7EB] hover:border-gray-300 cursor-pointer"}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {isSearchable && isOpen ? (
          <input
            type="text"
            autoFocus
            placeholder={displayValue || placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-full bg-transparent outline-none text-[14px] text-[#111827] placeholder:text-gray-400"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`text-[14px] truncate ${value ? "text-[#111827]" : "text-gray-500"}`}
          >
            {value ? translateDynamic(displayValue, t) : placeholder}
          </span>
        )}
        {!disabled &&
          (isOpen ? (
            <ChevronUp size={16} className="text-gray-500 shrink-0" />
          ) : (
            <ChevronDown size={16} className="text-gray-500 shrink-0" />
          ))}
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-100 rounded-[8px] shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[240px] overflow-y-auto w-full py-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const label = getOptionLabel ? getOptionLabel(opt) : opt;
                const isSelected =
                  value === opt || (value && opt && value.id === opt.id);
                return (
                  <div
                    key={idx}
                    className={`px-4 py-2.5 text-[14px] cursor-pointer transition-colors ${isSelected ? "bg-[#F9FAFB] text-[#014A36] font-medium" : "text-[#4B5563] hover:bg-gray-50"}`}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    {translateDynamic(label, t)}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-[14px] text-gray-500 text-center">
                {t("no_options_found")}
              </div>
            )}
          </div>
          {footerLabel && onFooterClick && (
            <div className="p-2 border-t border-gray-100 bg-white sticky bottom-0 z-10 w-full rounded-b-[8px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setSearchTerm("");
                  onFooterClick();
                }}
                className="w-full h-[46px] bg-[#073318] text-white rounded-[10px] text-[14px] font-semibold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Plus size={18} strokeWidth={2.5} />
                {footerLabel.replace(/^\+\s*/, "")}
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-[12px] text-red-500 mt-0.5">{error}</p>}
    </div>
  );
};

const ProductForm = ({
  mode = "add",
  initialData = null,
  onBack,
  onEdit,
  onSuccess,
}) => {
  const { t } = useTranslation(["modules", "common"]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const isView = mode === "view";

  const [uomList, setUomList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [subSubCategories, setSubSubCategories] = useState([]);
  const PRODUCT_TYPES = ["GOODS", "SERVICES"];

  const initialFormData = {
    productName: initialData?.product_name || "",
    productCode: initialData?.product_code || t("modules:auto_generated"),
    uom: initialData?.uom || null,
    productType: initialData?.product_type || "",
    category: initialData?.category || null,
    subcategory: initialData?.sub_category || null,
    subsubcategory: initialData?.sub_sub_category || null,
    hsnCode: initialData?.hsn_code || "",
    tax: initialData?.tax_rate ? initialData.tax_rate + "%" : "",
    description: initialData?.description || "",
  };

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [nameError, setNameError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isView || !formData.productName || formData.productName.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setNameError("");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // Fetch suggestions
        const suggestRes = await productService.getSuggestions(
          formData.productName,
        );
        setSuggestions(suggestRes);
        setShowSuggestions(suggestRes.length > 0);

        // Check uniqueness
        const checkRes = await productService.checkProductName(
          formData.productName,
          initialData?.id,
        );
        if (!checkRes.isUnique) {
          setNameError(
            t("modules:duplicate_product_name", "Product name already exists"),
          );
        } else {
          setNameError("");
        }
      } catch (error) {
        console.error("Error in product name checks:", error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.productName, isView, initialData?.id]);

  const validateField = (field, value) => {
    let error = "";
    if (field === "productName") {
      if (!value?.trim() || value.trim().length < 3) {
        error = "Enter valid product name (e.g., ABC Product)";
      }
    } else if (field === "description") {
      if (!value?.trim() || value.trim().length < 3) {
        error = "Enter valid product description";
      }
    } else if (field === "hsnCode") {
      if (!value || !/^\d{4,}$/.test(value.trim())) {
        error = "Enter valid HSN Code (min 4 digits)";
      }
    } else if (field === "uom") {
      if (!value) error = "Please select UOM";
    } else if (field === "productType") {
      if (!value) error = "Please select Product Type";
    } else if (field === "category") {
      if (!value) error = "Please select Category";
    } else if (field === "subcategory") {
      if (!value) error = "Please select Sub Category";
    } else if (field === "subsubcategory") {
      if (!value && subSubCategories.length > 0) error = "Please select Sub Sub Category";
    }

    setErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });

    return error;
  };

  const validateAll = () => {
    const fields = [
      "productName",
      "description",
      "hsnCode",
      "uom",
      "productType",
      "category",
      "subcategory",
      "subsubcategory",
    ];
    let isValid = true;
    fields.forEach((f) => {
      if (validateField(f, formData[f])) isValid = false;
    });
    return isValid;
  };
  const isDirty =
    mode === "edit"
      ? formData.productName !== initialFormData.productName ||
      formData.productCode !== initialFormData.productCode ||
      formData.uom !== initialFormData.uom ||
      formData.productType !== initialFormData.productType ||
      formData.category !== initialFormData.category ||
      formData.subcategory !== initialFormData.subcategory ||
      formData.subsubcategory !== initialFormData.subsubcategory ||
      formData.hsnCode !== initialFormData.hsnCode ||
      formData.tax !== initialFormData.tax ||
      formData.description !== initialFormData.description
      : true;

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [uoms, cats] = await Promise.all([
          productService.getUomsDropdown(),
          productService.getCategoriesDropdown(),
        ]);
        setUomList(uoms);
        setCategories(cats);

        if (mode === "add") {
          const codeRes = await productService.generateProductCode();
          handleInputChange("productCode", codeRes.product_code);
        }

        if (initialData?.category_id) {
          const subs = await productService.getSubCategoriesDropdown(
            initialData.category_id,
          );
          setSubCategories(subs);
        }

        if (initialData?.sub_category_id) {
          const subSubs = await productService.getSubSubCategoriesDropdown(
            initialData.sub_category_id,
          );
          setSubSubCategories(subSubs);
        }
      } catch (error) {
        console.error("Error fetching initial form data:", error);
        toast.error(t("common:error_fetching_data"));
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (isView) return;

    if (!formData.hsnCode || formData.hsnCode.length < 4) {
      handleInputChange("tax", "");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await productService.getTaxByHsn(formData.hsnCode);
        handleInputChange("tax", res.tax_rate + "%");
      } catch (error) {
        handleInputChange("tax", "");
        if (error.response?.status === 404) {
          toast.error(t("modules:invalid_hsn_code", "Invalid HSN Code"));
        } else {
          toast.error(t("common:error_fetching_data"));
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.hsnCode, isView]);

  const handleCategoryChange = async (val) => {
    handleInputChange("category", val);
    handleInputChange("subcategory", null);
    handleInputChange("subsubcategory", null);
    setSubCategories([]);
    setSubSubCategories([]);
    if (val?.id) {
      try {
        const subs = await productService.getSubCategoriesDropdown(val.id);
        setSubCategories(subs);
      } catch (error) {
        console.error("Error fetching subcategories:", error);
      }
    }
  };

  const handleSubCategoryChange = async (val) => {
    handleInputChange("subcategory", val);
    handleInputChange("subsubcategory", null);
    setSubSubCategories([]);
    if (val?.id) {
      try {
        const subSubs = await productService.getSubSubCategoriesDropdown(val.id);
        setSubSubCategories(subSubs);
      } catch (error) {
        console.error("Error fetching subsubcategories:", error);
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      validateField(field, value);
    }
  };

  const handleSubmit = async () => {
    if (mode === "edit" && !isDirty) {
      toast.error("Please make changes to save");
      return;
    }
    if (!validateAll()) return;
    setLoading(true);
    try {
      const payload = {
        product_name: formData.productName,
        uom_id: formData.uom?.id,
        product_type: formData.productType,
        category_id: formData.category?.id,
        sub_category_id: formData.subcategory?.id,
        sub_sub_category_id: formData.subsubcategory?.id,
        hsn_code: formData.hsnCode,
        description: formData.description,
      };

      if (mode === "add") {
        await productService.createProduct(payload);
      } else {
        await productService.updateProduct(initialData.id, payload);
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving product:", error);
      const errorMsg =
        error.response?.data?.message || t("common:error_saving_data");
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label,
    field,
    placeholder,
    showAsterisk = true,
    readOnly = false,
  ) => {
    const isProductName = field === "productName";

    return (
      <div
        className="flex flex-col gap-1.5 w-full relative"
        ref={isProductName ? suggestionsRef : null}
      >
        <label className="text-[13px] font-semibold text-[#4B5563]">
          {label} {showAsterisk && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder={placeholder}
            readOnly={readOnly}
            disabled={isView}
            autoComplete="off"
            className={`w-full h-[44px] border rounded-[8px] px-4 text-[14px] outline-none transition-all 
                            ${(errors[field] || (isProductName && nameError)) && !readOnly ? "border-red-500 bg-red-50/10" : "border-[#E5E7EB]"}
                            ${isView || readOnly ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white text-[#111827] focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10 hover:border-gray-300"}`}
            value={formData[field]}
            onFocus={() =>
              isProductName && suggestions.length > 0 && setShowSuggestions(true)
            }
            onChange={(e) => {
              let val = e.target.value;
              if (field === "hsnCode") val = val.replace(/\D/g, "");
              handleInputChange(field, val);
              if (isProductName && nameError) setNameError("");
            }}
            onBlur={() => {
              if (!isView && !readOnly) validateField(field, formData[field]);
            }}
          />

          {isProductName && showSuggestions && !isView && suggestions.length > 0 && (
            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-100 rounded-[8px] shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="max-h-[200px] overflow-y-auto w-full py-1 custom-scrollbar">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2.5 text-[14px] text-[#4B5563] hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      handleInputChange("productName", suggestion);
                      setShowSuggestions(false);
                      setNameError(
                        t(
                          "modules:duplicate_product_name",
                          "Product name already exists",
                        ),
                      );
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {(errors[field] || (isProductName && nameError)) && (
          <p className="text-[12px] text-red-500 mt-0.5">
            {errors[field] || nameError}
          </p>
        )}
      </div>
    );
  };

  const renderViewMode = () => (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full overflow-hidden mb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
          {t("modules:view_product")}
        </h2>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 h-[44px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
        >
          <ArrowLeft size={18} />
          {t("common:back")}
        </button>
      </div>

      {/* Content Table */}
      <div className="flex flex-col">
        {[
          { label: t("modules:product_name"), value: formData.productName },
          { label: t("modules:product_code"), value: formData.productCode },
          { label: t("modules:uom"), value: formData.uom?.gst_uom },
          { label: t("modules:product_type"), value: formData.productType },
          {
            label: t("modules:sub_category"),
            value: formData.subcategory?.name,
          },
          ...(formData.subsubcategory ? [{
            label: t("modules:sub_sub_category", "Sub-SubCategory"),
            value: formData.subsubcategory?.name,
          }] : []),
          { label: t("modules:hsn_code"), value: formData.hsnCode },
          { label: t("modules:tax_percent"), value: formData.tax },
          {
            label: t("modules:product_desc"),
            value: formData.description || "-",
          },
        ].map((item, idx) => (
          <div
            key={idx}
            className="flex border-b border-[#F3F4F6] min-h-[56px] last:border-b-0 group"
          >
            <div className="w-[240px] bg-[#F9FAFB] px-8 py-4 flex items-center border-r border-[#F3F4F6]">
              <span className="text-[14px] font-bold text-gray-500 uppercase tracking-tight">
                {item.label}:
              </span>
            </div>
            <div className="flex-1 px-8 py-4 flex items-center bg-white group-hover:bg-[#F9FAFB]/50 transition-colors">
              <span className="text-[16px] font-bold text-[#111827]">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-8 py-6 bg-[#F9FAFB]/50 flex justify-end gap-3 border-t border-[#F3F4F6]">
        <button
          onClick={onBack}
          className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-white transition-all bg-white"
        >
          {t("common:cancel")}
        </button>
        <button
          onClick={() => onEdit && onEdit(initialData)}
          className="px-8 h-[46px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center min-w-[140px]"
        >
          Save Product
        </button>
      </div>
    </div>
  );

  if (isView) return renderViewMode();

  return (
    <div className="flex flex-col w-full h-full animate-in fade-in duration-300 p-2">
      <div
        className={`bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full mb-12 ${isView ? "overflow-hidden" : "overflow-visible"}`}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
              {mode === "add"
                ? "Add New Product"
                : mode === "edit"
                  ? "Edit Product"
                  : "View Product"}
            </h2>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {isView ? (
              <button
                type="button"
                onClick={() => onEdit && onEdit(initialData)}
                className="px-6 h-[40px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm flex items-center justify-center"
              >
                {t("modules:edit_product") || "Edit Product"}
              </button>
            ) : mode === "edit" ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className={`px-6 h-[40px] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm flex items-center justify-center min-w-[140px] ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#073318] hover:bg-[#04200f]"}`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : 'Save Product'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="px-6 h-[40px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              {t("common:back")}
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8 md:p-10 flex flex-col gap-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 w-full">
            {renderInput(
              t("modules:product_name"),
              "productName",
              t("modules:enter_product_name"),
            )}
            {renderInput(
              t("modules:product_code"),
              "productCode",
              t("modules:product_code_auto"),
              true,
              true,
            )}

            <CustomSelect
              label={t("modules:uom")}
              placeholder={t("common:select") + " " + t("modules:uom")}
              options={uomList}
              value={formData.uom}
              onChange={(val) => handleInputChange("uom", val)}
              getOptionLabel={(opt) => opt.gst_uom}
              isSearchable={true}
              showAsterisk={true}
              disabled={isView}
              footerLabel="+ Add UOM"
              onFooterClick={() => navigate("/seller/masters/unit-master")}
              error={errors.uom}
            />

            <CustomSelect
              label={t("modules:product_type")}
              placeholder={t("common:select") + " " + t("modules:product_type")}
              options={PRODUCT_TYPES}
              value={formData.productType}
              onChange={(val) => handleInputChange("productType", val)}
              showAsterisk={true}
              disabled={isView}
              error={errors.productType}
            />

            <CustomSelect
              label={t("modules:category")}
              placeholder={t("common:select") + " " + t("modules:category")}
              options={categories}
              value={formData.category}
              onChange={(val) => handleCategoryChange(val)}
              getOptionLabel={(opt) => opt.name}
              showAsterisk={true}
              disabled={isView}
              footerLabel="+ Add Category"
              onFooterClick={() => navigate("/seller/masters/category")}
              error={errors.category}
            />

            <CustomSelect
              label={t("modules:sub_category")}
              placeholder={t("common:select") + " " + t("modules:sub_category")}
              options={subCategories}
              value={formData.subcategory}
              onChange={(val) => handleSubCategoryChange(val)}
              getOptionLabel={(opt) => opt.name}
              showAsterisk={true}
              disabled={isView || !formData.category}
              footerLabel="+ Add Sub Category"
              onFooterClick={() => navigate("/seller/masters/category")}
              error={errors.subcategory}
            />

            {subSubCategories.length > 0 && (
              <CustomSelect
                label={t("modules:sub_sub_category", "Sub-SubCategory")}
                placeholder={t("common:select") + " " + t("modules:sub_sub_category", "Sub-SubCategory")}
                options={subSubCategories}
                value={formData.subsubcategory}
                onChange={(val) => handleInputChange("subsubcategory", val)}
                getOptionLabel={(opt) => opt.name}
                showAsterisk={true}
                disabled={isView || !formData.subcategory}
                footerLabel="+ Add Sub-SubCategory"
                onFooterClick={() => navigate("/seller/masters/category")}
                error={errors.subsubcategory}
              />
            )}

            {renderInput(
              t("modules:hsn_code"),
              "hsnCode",
              t("common:enter") + " " + t("modules:hsn_code"),
            )}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[13px] font-semibold text-[#4B5563]">
                {t("modules:tax_percent")}
              </label>
              <input
                type="text"
                readOnly
                disabled={true}
                placeholder={t("modules:tax_auto")}
                className="w-full h-[44px] border border-[#E5E7EB] rounded-[8px] px-4 text-[14px] text-gray-500 outline-none transition-all bg-gray-50 cursor-not-allowed"
                value={formData.tax}
              />
            </div>
            <div className="md:col-span-2">
              {renderInput(
                t("modules:product_desc"),
                "description",
                t("modules:enter_product_desc"),
              )}
            </div>
          </div>
        </div>

        {/* Footer Buttons - Only for Add mode */}
        {mode === "add" && (
          <div className="px-8 py-6 bg-[#F9FAFB]/50 flex justify-end gap-3 border-t border-[#F3F4F6]">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`px-10 h-[46px] text-white rounded-[10px] text-[14px] font-bold transition-all shadow-md flex items-center justify-center min-w-[160px] ${loading ? "bg-gray-400 cursor-not-allowed shadow-none" : "bg-[#073318] hover:bg-[#04200f]"}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : 'Save Product'}
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="px-10 h-[46px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-white transition-all bg-white shadow-sm flex items-center justify-center"
            >
              {t("common:cancel")}
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e5e7eb;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #d1d5db;
        }
      `}</style>
    </div>
  );
};

export default ProductForm;
