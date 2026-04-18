"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  Trash2,
  Plus,
  Download,
  RotateCcw,
  Boxes,
  Search,
  Image as ImageIcon,
  ClipboardList,
  ArrowRightLeft,
  ShoppingCart,
  PackageCheck,
  ChevronsUpDown,
} from "lucide-react";

function money(n: number) {
  const num = Number(n || 0);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(num);
}

function num(v: string | number) {
  return Number(v || 0);
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: unknown) => {
    const str = String(value ?? "").replace(/"/g, '""');
    return `"${str}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const WAREHOUSES = ["中国仓库", "马来西亚仓库"] as const;
const PURCHASE_STATUSES = ["待采购", "已下单", "在途", "已签收", "已入库"] as const;
const TRANSFER_STATUSES = ["待出库", "已出库", "在途", "已到货", "已入库"] as const;
const ORDER_STATUSES = ["待采购", "已采购", "在途", "准备发货", "已发货", "已完成"] as const;

type WarehouseName = (typeof WAREHOUSES)[number];
type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
type TransferStatus = (typeof TRANSFER_STATUSES)[number];
type OrderStatus = (typeof ORDER_STATUSES)[number];

type ProductRecord = {
  id: string;
  chineseName: string;
  model: string;
  spec: string;
  sku: string;
  imageUrl: string;
  createdAt: string;
};

type ExpenseItem = {
  id: string;
  name: string;
  amountMyr: number;
  notes: string;
  createdAt: string;
};

type PurchaseRecord = {
  id: string;
  purchaseNo: string;
  purchaseDate: string;
  warehouse: WarehouseName;
  supplier: string;
  sku: string;
  productName: string;
  variant: string;
  qty: number;
  totalPurchaseMyr: number;
  unitCostMyr: number;
  trackingNo: string;
  status: PurchaseStatus;
  isInventorySynced: boolean;
  createdAt: string;
};

type TransferItem = {
  sku: string;
  productName: string;
  variant: string;
  qty: number;
  baseUnitCostMyr: number;
  allocatedFeePerUnitMyr: number;
  finalUnitCostMyr: number;
};

type TransferRecord = {
  id: string;
  transferNo: string;
  purchaseNos: string[];
  fromWarehouse: WarehouseName;
  toWarehouse: WarehouseName;
  courierCompany: string;
  trackingNo: string;
  transferFeeMyr: number;
  status: TransferStatus;
  totalQty: number;
  items: TransferItem[];
  isSourceSynced: boolean;
  isTargetSynced: boolean;
  createdAt: string;
};

type InventoryItem = {
  id: string;
  warehouse: WarehouseName;
  sku: string;
  productName: string;
  variant: string;
  stockQty: number;
  lockedQty: number;
  unitCostMyr: number;
  supplier: string;
  updatedAt: string;
};

type OrderRecord = {
  id: string;
  orderNo: string;
  orderDate: string;
  customer: string;
  platform: string;
  sku: string;
  productName: string;
  variant: string;
  qty: number;
  preferredWarehouse: WarehouseName;
  status: OrderStatus;
  hasStock: boolean;
  stockMessage: string;
  isStockLocked: boolean;
  isStockOut: boolean;
  stockOutDate: string;
  visiblePurchaseUnitCostMyr: number;
  lockedUnitCostMyr: number;
  lockedTotalCostMyr: number;
  isCostLocked: boolean;
  salePriceMyr: number;
  receivableMyr: number;
  shippingFeeMyr: number;
  voucherMyr: number;
  commissionFeeMyr: number;
  transactionFeeMyr: number;
  otherDiscountMyr: number;
  otherFeeMyr: number;
  finalProfitMyr: number;
  isProfitFinalized: boolean;
  notes: string;
  createdAt: string;
};

const LS_KEYS = {
  products: "erp2_products_v1",
  expenses: "erp2_expenses_v1",
  purchases: "erp2_purchases_v1",
  transfers: "erp2_transfers_v1",
  inventory: "erp2_inventory_v1",
  orders: "erp2_orders_v1",
};

const defaultProduct = {
  chineseName: "",
  model: "",
  spec: "",
  sku: "",
  imageUrl: "",
};

const defaultExpense = {
  name: "",
  amountMyr: 0,
  notes: "",
};

const defaultPurchase = {
  purchaseNo: "",
  purchaseDate: "",
  warehouse: "中国仓库" as WarehouseName,
  supplier: "",
  sku: "",
  productName: "",
  variant: "",
  qty: 1,
  totalPurchaseMyr: 0,
  trackingNo: "",
  status: "待采购" as PurchaseStatus,
};

const defaultTransfer = {
  purchaseNosText: "",
  fromWarehouse: "中国仓库" as WarehouseName,
  toWarehouse: "马来西亚仓库" as WarehouseName,
  courierCompany: "",
  trackingNo: "",
  transferFeeMyr: 0,
  status: "待出库" as TransferStatus,
};

const defaultOrder = {
  orderNo: "",
  orderDate: "",
  customer: "",
  platform: "Lazada",
  sku: "",
  productName: "",
  variant: "",
  qty: 1,
  preferredWarehouse: "马来西亚仓库" as WarehouseName,
  notes: "",
};

function safeParse<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export default function ERPRefactorV2Page() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  const [productForm, setProductForm] = useState(defaultProduct);
  const [expenseForm, setExpenseForm] = useState(defaultExpense);
  const [purchaseForm, setPurchaseForm] = useState(defaultPurchase);
  const [transferForm, setTransferForm] = useState(defaultTransfer);
  const [orderForm, setOrderForm] = useState(defaultOrder);

  const [inventoryKeyword, setInventoryKeyword] = useState("");
  const [orderKeyword, setOrderKeyword] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"全部" | OrderStatus>("全部");
  const [orderWarehouseFilter, setOrderWarehouseFilter] = useState<"全部" | WarehouseName>("全部");
  const [orderStockFilter, setOrderStockFilter] = useState<"全部" | "有库存" | "无库存">("全部");
  const [openFeeRows, setOpenFeeRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("读取 products 失败:", error);
        return;
      }

      const mapped = (data || []).map((item) => ({
        id: item.id,
        chineseName: item.chinese_name || "",
        model: item.model || "",
        spec: item.spec || "",
        sku: item.sku || "",
        imageUrl: item.image_url || "",
        createdAt: item.created_at || "",
      }));

      setProducts(mapped);
    };

    const loadPurchases = async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("读取 purchases 失败:", error);
        return;
      }

      const mapped = (data || []).map((item) => ({
        id: item.id,
        purchaseNo: item.purchase_no || "",
        purchaseDate: item.purchase_date || "",
        warehouse: item.warehouse || "中国仓库",
        supplier: item.supplier || "",
        sku: item.sku || "",
        productName: item.product_name || "",
        variant: item.variant || "",
        qty: Number(item.qty || 0),
        totalPurchaseMyr: Number(item.total_purchase_myr || 0),
        unitCostMyr: Number(item.unit_cost_myr || 0),
        trackingNo: item.tracking_no || "",
        status: item.status || "待采购",
        isInventorySynced: !!item.is_inventory_synced,
        createdAt: item.created_at || "",
      }));

      setPurchases(mapped);
    };

    const loadOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("读取 orders 失败:", error);
        return;
      }

      const mapped = (data || []).map((item) => ({
        id: item.id,
        orderNo: item.order_no || "",
        orderDate: item.order_date || "",
        customer: item.customer || "",
        platform: item.platform || "",
        sku: item.sku || "",
        productName: item.product_name || "",
        variant: item.variant || "",
        qty: Number(item.qty || 0),
        preferredWarehouse: item.preferred_warehouse || "马来西亚仓库",
        status: item.status || "待采购",
        hasStock: !!item.has_stock,
        stockMessage: item.stock_message || "",
        isStockLocked: !!item.is_stock_locked,
        isStockOut: !!item.is_stock_out,
        stockOutDate: item.stock_out_date || "",
        visiblePurchaseUnitCostMyr: Number(item.visible_purchase_unit_cost_myr || 0),
        lockedUnitCostMyr: Number(item.locked_unit_cost_myr || 0),
        lockedTotalCostMyr: Number(item.locked_total_cost_myr || 0),
        isCostLocked: !!item.is_cost_locked,
        salePriceMyr: Number(item.sale_price_myr || 0),
        receivableMyr: Number(item.receivable_myr || 0),
        shippingFeeMyr: Number(item.shipping_fee_myr || 0),
        voucherMyr: Number(item.voucher_myr || 0),
        commissionFeeMyr: Number(item.commission_fee_myr || 0),
        transactionFeeMyr: Number(item.transaction_fee_myr || 0),
        otherDiscountMyr: Number(item.other_discount_myr || 0),
        otherFeeMyr: Number(item.other_fee_myr || 0),
        finalProfitMyr: Number(item.final_profit_myr || 0),
        isProfitFinalized: !!item.is_profit_finalized,
        notes: item.notes || "",
        createdAt: item.created_at || "",
      }));

      setOrders(mapped);
    };

    const loadInventory = async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("读取 inventory 失败:", error);
        return;
      }

      const mapped = (data || []).map((item) => ({
        id: item.id,
        warehouse: item.warehouse || "中国仓库",
        sku: item.sku || "",
        productName: item.product_name || "",
        variant: item.variant || "",
        stockQty: Number(item.stock_qty || 0),
        lockedQty: Number(item.locked_qty || 0),
        unitCostMyr: Number(item.unit_cost_myr || 0),
        supplier: item.supplier || "",
        updatedAt: item.updated_at || "",
      }));

      setInventory(mapped);
    };

    const loadTransfers = async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("读取 transfers 失败:", error);
        return;
      }

      const mapped = (data || []).map((item) => ({
        id: item.id,
        transferNo: item.transfer_no || "",
        purchaseNos: Array.isArray(item.purchase_nos) ? item.purchase_nos : [],
        fromWarehouse: item.from_warehouse || "中国仓库",
        toWarehouse: item.to_warehouse || "马来西亚仓库",
        courierCompany: item.courier_company || "",
        trackingNo: item.tracking_no || "",
        transferFeeMyr: Number(item.transfer_fee_myr || 0),
        status: item.status || "待出库",
        totalQty: Number(item.total_qty || 0),
        items: Array.isArray(item.items) ? item.items : [],
        isSourceSynced: !!item.is_source_synced,
        isTargetSynced: !!item.is_target_synced,
        createdAt: item.created_at || "",
      }));

      setTransfers(mapped);
    };

    loadProducts();
    loadPurchases();
    loadOrders();
    loadInventory();
    loadTransfers();
    setExpenses(safeParse(localStorage.getItem(LS_KEYS.expenses), [] as ExpenseItem[]));
  }, []);

  useEffect(() => localStorage.setItem(LS_KEYS.expenses, JSON.stringify(expenses)), [expenses]);

  const purchaseCalc = useMemo(() => {
    const qty = num(purchaseForm.qty);
    const total = num(purchaseForm.totalPurchaseMyr);
    return {
      totalPurchaseMyr: total,
      unitCostMyr: qty > 0 ? total / qty : 0,
    };
  }, [purchaseForm]);

  const productByPurchaseSku = useMemo(
    () => products.find((p) => p.sku.trim().toLowerCase() === purchaseForm.sku.trim().toLowerCase()),
    [products, purchaseForm.sku]
  );

  const productByOrderSku = useMemo(
    () => products.find((p) => p.sku.trim().toLowerCase() === orderForm.sku.trim().toLowerCase()),
    [products, orderForm.sku]
  );

  const transferPurchaseNoList = useMemo(() => {
    return transferForm.purchaseNosText
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [transferForm.purchaseNosText]);

  const transferCandidates = useMemo(() => {
    if (transferPurchaseNoList.length === 0) return [];
    return purchases.filter((p) => transferPurchaseNoList.includes(p.purchaseNo.trim()));
  }, [purchases, transferPurchaseNoList]);

  const inventoryStatsBySku = useMemo(() => {
    const map = new Map<string, {
      chinaStock: number;
      chinaInTransit: number;
      malaysiaStock: number;
      malaysiaInTransit: number;
    }>();

    for (const p of products) {
      map.set(p.sku, { chinaStock: 0, chinaInTransit: 0, malaysiaStock: 0, malaysiaInTransit: 0 });
    }

    for (const item of inventory) {
      const current = map.get(item.sku) || { chinaStock: 0, chinaInTransit: 0, malaysiaStock: 0, malaysiaInTransit: 0 };
      if (item.warehouse === "中国仓库") current.chinaStock += num(item.stockQty);
      if (item.warehouse === "马来西亚仓库") current.malaysiaStock += num(item.stockQty);
      map.set(item.sku, current);
    }

    for (const purchase of purchases) {
      if (purchase.isInventorySynced) continue;
      const current = map.get(purchase.sku) || { chinaStock: 0, chinaInTransit: 0, malaysiaStock: 0, malaysiaInTransit: 0 };
      if (purchase.warehouse === "中国仓库") current.chinaInTransit += num(purchase.qty);
      if (purchase.warehouse === "马来西亚仓库") current.malaysiaInTransit += num(purchase.qty);
      map.set(purchase.sku, current);
    }

    for (const transfer of transfers) {
      if (!transfer.isTargetSynced) {
        for (const item of transfer.items) {
          const current = map.get(item.sku) || { chinaStock: 0, chinaInTransit: 0, malaysiaStock: 0, malaysiaInTransit: 0 };
          if (transfer.toWarehouse === "中国仓库") current.chinaInTransit += num(item.qty);
          if (transfer.toWarehouse === "马来西亚仓库") current.malaysiaInTransit += num(item.qty);
          map.set(item.sku, current);
        }
      }
    }

    return map;
  }, [products, purchases, transfers, inventory]);

  const filteredInventory = useMemo(() => {
    const kw = inventoryKeyword.trim().toLowerCase();
    if (!kw) return inventory;
    return inventory.filter((i) =>
      [i.productName, i.sku, i.variant, i.warehouse].some((v) => String(v || "").toLowerCase().includes(kw))
    );
  }, [inventory, inventoryKeyword]);

  const filteredOrders = useMemo(() => {
    let rows = [...orders];
    const kw = orderKeyword.trim().toLowerCase();

    if (kw) {
      rows = rows.filter((o) =>
        [o.orderNo, o.sku, o.productName, o.variant, o.customer, o.platform].some((v) =>
          String(v || "").toLowerCase().includes(kw)
        )
      );
    }
    if (orderStatusFilter !== "全部") rows = rows.filter((o) => o.status === orderStatusFilter);
    if (orderWarehouseFilter !== "全部") rows = rows.filter((o) => o.preferredWarehouse === orderWarehouseFilter);
    if (orderStockFilter === "有库存") rows = rows.filter((o) => o.hasStock);
    if (orderStockFilter === "无库存") rows = rows.filter((o) => !o.hasStock);

    return rows;
  }, [orders, orderKeyword, orderStatusFilter, orderWarehouseFilter, orderStockFilter]);

  const summary = useMemo(() => {
    const totalReceivable = orders.reduce((s, o) => s + num(o.receivableMyr), 0);
    const totalLockedCost = orders.reduce((s, o) => s + num(o.lockedTotalCostMyr), 0);
    const totalProfitCompleted = orders
      .filter((o) => o.isProfitFinalized)
      .reduce((s, o) => s + num(o.finalProfitMyr), 0);
    const totalInventoryQty = inventory.reduce((s, i) => s + num(i.stockQty), 0);
    const totalExpenseCost = expenses.reduce((s, e) => s + num(e.amountMyr), 0);

    return {
      totalReceivable,
      totalLockedCost,
      totalProfitCompleted,
      totalInventoryQty,
      totalExpenseCost,
    };
  }, [orders, inventory, expenses]);

  function getProductBySku(sku: string) {
    return products.find((p) => p.sku.trim().toLowerCase() === sku.trim().toLowerCase());
  }

  function getInventoryRecord(warehouse: WarehouseName, sku: string, variant: string) {
    return inventory.find(
      (i) =>
        i.warehouse === warehouse &&
        i.sku.trim().toLowerCase() === sku.trim().toLowerCase() &&
        (i.variant || "") === (variant || "")
    );
  }

  function ensureInventoryRecord(
    draft: InventoryItem[],
    warehouse: WarehouseName,
    sku: string,
    productName: string,
    variant: string,
    supplier: string,
    unitCostMyr: number
  ) {
    const existing = draft.find(
      (i) =>
        i.warehouse === warehouse &&
        i.sku.trim().toLowerCase() === sku.trim().toLowerCase() &&
        (i.variant || "") === (variant || "")
    );
    if (existing) return existing;

    const created: InventoryItem = {
      id: crypto.randomUUID(),
      warehouse,
      sku,
      productName,
      variant,
      stockQty: 0,
      lockedQty: 0,
      unitCostMyr,
      supplier,
      updatedAt: new Date().toLocaleString(),
    };
    draft.unshift(created);
    return created;
  }

  async function refreshInventoryFromSupabase() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("刷新 inventory 失败:", error);
      return;
    }

    const mapped = (data || []).map((item) => ({
      id: item.id,
      warehouse: item.warehouse || "中国仓库",
      sku: item.sku || "",
      productName: item.product_name || "",
      variant: item.variant || "",
      stockQty: Number(item.stock_qty || 0),
      lockedQty: Number(item.locked_qty || 0),
      unitCostMyr: Number(item.unit_cost_myr || 0),
      supplier: item.supplier || "",
      updatedAt: item.updated_at || "",
    }));

    setInventory(mapped);
  }

  async function upsertInventoryRecord(params: {
    warehouse: WarehouseName;
    sku: string;
    productName: string;
    variant: string;
    stockQty?: number;
    lockedQty?: number;
    unitCostMyr?: number;
    supplier?: string;
  }) {
    const { warehouse, sku, productName, variant } = params;
    const existing = inventory.find(
      (i) =>
        i.warehouse === warehouse &&
        i.sku.trim().toLowerCase() === sku.trim().toLowerCase() &&
        (i.variant || "") === (variant || "")
    );

    if (existing) {
      const payload = {
        warehouse,
        sku,
        product_name: productName,
        variant,
        stock_qty: params.stockQty ?? existing.stockQty,
        locked_qty: params.lockedQty ?? existing.lockedQty,
        unit_cost_myr: params.unitCostMyr ?? existing.unitCostMyr,
        supplier: params.supplier ?? existing.supplier,
        updated_at: new Date().toLocaleString(),
      };

      const { error } = await supabase.from("inventory").update(payload).eq("id", existing.id);
      if (error) {
        console.error("更新 inventory 失败:", error);
        throw error;
      }
    } else {
      const payload = {
        warehouse,
        sku,
        product_name: productName,
        variant,
        stock_qty: params.stockQty ?? 0,
        locked_qty: params.lockedQty ?? 0,
        unit_cost_myr: params.unitCostMyr ?? 0,
        supplier: params.supplier ?? "",
        updated_at: new Date().toLocaleString(),
      };

      const { error } = await supabase.from("inventory").insert(payload);
      if (error) {
        console.error("新增 inventory 失败:", error);
        throw error;
      }
    }
  }

  function getAvailableStock(warehouse: WarehouseName, sku: string, variant: string) {
    const item = getInventoryRecord(warehouse, sku, variant);
    if (!item) return 0;
    return num(item.stockQty) - num(item.lockedQty);
  }

  function getCurrentUnitCost(warehouse: WarehouseName, sku: string, variant: string) {
    const item = getInventoryRecord(warehouse, sku, variant);
    return item ? num(item.unitCostMyr) : 0;
  }

  function computeOrderStockStatus(warehouse: WarehouseName, sku: string, variant: string, qty: number) {
    const available = getAvailableStock(warehouse, sku, variant);
    if (available >= qty) return { hasStock: true, stockMessage: `有库存（可用 ${available}）` };
    if (available > 0) return { hasStock: false, stockMessage: `库存不足（可用 ${available}）` };
    return { hasStock: false, stockMessage: "无库存" };
  }

  const handleProductImageUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProductForm((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const saveProduct = async () => {
    if (!productForm.chineseName.trim() || !productForm.sku.trim()) {
      alert("请至少填写中文名称和 SKU。");
      return;
    }

    const { data: existing, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("sku", productForm.sku.trim())
      .maybeSingle();

    if (checkError) {
      alert("检查商品失败");
      console.error(checkError);
      return;
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("products")
        .update({
          chinese_name: productForm.chineseName,
          model: productForm.model,
          spec: productForm.spec,
          sku: productForm.sku,
          image_url: productForm.imageUrl,
        })
        .eq("id", existing.id);

      if (error) {
        alert("更新商品失败");
        console.error(error);
        return;
      }
    } else {
      const { error } = await supabase.from("products").insert({
        chinese_name: productForm.chineseName,
        model: productForm.model,
        spec: productForm.spec,
        sku: productForm.sku,
        image_url: productForm.imageUrl,
      });

      if (error) {
        alert("新增商品失败");
        console.error(error);
        return;
      }
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("刷新商品列表失败");
      console.error(error);
      return;
    }

    const mapped = (data || []).map((item) => ({
      id: item.id,
      chineseName: item.chinese_name || "",
      model: item.model || "",
      spec: item.spec || "",
      sku: item.sku || "",
      imageUrl: item.image_url || "",
      createdAt: item.created_at || "",
    }));

    setProducts(mapped);
    setProductForm(defaultProduct);
  };

  const saveExpense = () => {
    if (!expenseForm.name.trim() || num(expenseForm.amountMyr) <= 0) {
      alert("请填写成本名称和金额。");
      return;
    }
    setExpenses((prev) => [
      {
        id: crypto.randomUUID(),
        name: expenseForm.name,
        amountMyr: num(expenseForm.amountMyr),
        notes: expenseForm.notes,
        createdAt: new Date().toLocaleString(),
      },
      ...prev,
    ]);
    setExpenseForm(defaultExpense);
  };

  const savePurchase = async () => {
    const qty = num(purchaseForm.qty);
    if (!purchaseForm.purchaseNo || !purchaseForm.purchaseDate || !purchaseForm.sku || qty <= 0) {
      alert("请填写采购单号、采购日期、SKU 和数量。");
      return;
    }

    const product = getProductBySku(purchaseForm.sku);
    const payload = {
      purchase_no: purchaseForm.purchaseNo,
      purchase_date: purchaseForm.purchaseDate,
      warehouse: purchaseForm.warehouse,
      supplier: purchaseForm.supplier,
      sku: purchaseForm.sku,
      product_name: purchaseForm.productName || product?.chineseName || "",
      variant: purchaseForm.variant || product?.spec || "",
      qty,
      total_purchase_myr: num(purchaseForm.totalPurchaseMyr),
      unit_cost_myr: purchaseCalc.unitCostMyr,
      tracking_no: purchaseForm.trackingNo,
      status: purchaseForm.status,
      is_inventory_synced: purchaseForm.status === "已签收" || purchaseForm.status === "已入库",
    };

    const { error: insertError } = await supabase.from("purchases").insert(payload);

    if (insertError) {
      alert("新增采购单失败");
      console.error(insertError);
      return;
    }

    if (payload.is_inventory_synced) {
      try {
        const existingInv = inventory.find(
          (i) =>
            i.warehouse === payload.warehouse &&
            i.sku.trim().toLowerCase() === payload.sku.trim().toLowerCase() &&
            (i.variant || "") === (payload.variant || "")
        );

        await upsertInventoryRecord({
          warehouse: payload.warehouse as WarehouseName,
          sku: payload.sku,
          productName: payload.product_name,
          variant: payload.variant,
          stockQty: (existingInv?.stockQty || 0) + qty,
          lockedQty: existingInv?.lockedQty || 0,
          unitCostMyr: payload.unit_cost_myr,
          supplier: payload.supplier,
        });
        await refreshInventoryFromSupabase();
      } catch (e) {
        alert("采购入库同步库存失败");
        console.error(e);
      }
    }

    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("刷新采购单列表失败");
      console.error(error);
      return;
    }

    const mapped = (data || []).map((item) => ({
      id: item.id,
      purchaseNo: item.purchase_no || "",
      purchaseDate: item.purchase_date || "",
      warehouse: item.warehouse || "中国仓库",
      supplier: item.supplier || "",
      sku: item.sku || "",
      productName: item.product_name || "",
      variant: item.variant || "",
      qty: Number(item.qty || 0),
      totalPurchaseMyr: Number(item.total_purchase_myr || 0),
      unitCostMyr: Number(item.unit_cost_myr || 0),
      trackingNo: item.tracking_no || "",
      status: item.status || "待采购",
      isInventorySynced: !!item.is_inventory_synced,
      createdAt: item.created_at || "",
    }));

    setPurchases(mapped);
    setPurchaseForm(defaultPurchase);
  };

  const markPurchaseSigned = async (id: string) => {
    const purchase = purchases.find((p) => p.id === id);
    if (!purchase || purchase.isInventorySynced) return;

    const { error } = await supabase
      .from("purchases")
      .update({
        status: "已入库",
        is_inventory_synced: true,
      })
      .eq("id", id);

    if (error) {
      alert("更新采购单失败");
      console.error(error);
      return;
    }

    setPurchases((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "已入库", isInventorySynced: true } : p
      )
    );

    try {
      const existingInv = inventory.find(
        (i) =>
          i.warehouse === purchase.warehouse &&
          i.sku.trim().toLowerCase() === purchase.sku.trim().toLowerCase() &&
          (i.variant || "") === (purchase.variant || "")
      );

      await upsertInventoryRecord({
        warehouse: purchase.warehouse,
        sku: purchase.sku,
        productName: purchase.productName,
        variant: purchase.variant,
        stockQty: (existingInv?.stockQty || 0) + num(purchase.qty),
        lockedQty: existingInv?.lockedQty || 0,
        unitCostMyr: purchase.unitCostMyr,
        supplier: purchase.supplier,
      });
      await refreshInventoryFromSupabase();
    } catch (e) {
      alert("签收入库同步库存失败");
      console.error(e);
    }
  };

  const createOrder = async () => {
    if (!orderForm.orderNo || !orderForm.orderDate || !orderForm.sku || num(orderForm.qty) <= 0) {
      alert("请填写订单号、订单日期、SKU 和数量。");
      return;
    }
    const product = getProductBySku(orderForm.sku);
    const variant = orderForm.variant || product?.spec || "";
    const productName = orderForm.productName || product?.chineseName || "";
    const stockInfo = computeOrderStockStatus(orderForm.preferredWarehouse, orderForm.sku, variant, num(orderForm.qty));
    const currentUnitCost = getCurrentUnitCost(orderForm.preferredWarehouse, orderForm.sku, variant);

    const payload = {
      order_no: orderForm.orderNo,
      order_date: orderForm.orderDate,
      customer: orderForm.customer,
      platform: orderForm.platform,
      sku: orderForm.sku,
      product_name: productName,
      variant,
      qty: num(orderForm.qty),
      preferred_warehouse: orderForm.preferredWarehouse,
      status: stockInfo.hasStock ? "准备发货" : "待采购",
      has_stock: stockInfo.hasStock,
      stock_message: stockInfo.stockMessage,
      is_stock_locked: false,
      is_stock_out: false,
      stock_out_date: "",
      visible_purchase_unit_cost_myr: currentUnitCost,
      locked_unit_cost_myr: 0,
      locked_total_cost_myr: 0,
      is_cost_locked: false,
      sale_price_myr: 0,
      receivable_myr: 0,
      shipping_fee_myr: 0,
      voucher_myr: 0,
      commission_fee_myr: 0,
      transaction_fee_myr: 0,
      other_discount_myr: 0,
      other_fee_myr: 0,
      final_profit_myr: 0,
      is_profit_finalized: false,
      notes: orderForm.notes,
    };

    const { error: insertError } = await supabase.from("orders").insert(payload);

    if (insertError) {
      alert("新增订单失败");
      console.error(insertError);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("刷新订单列表失败");
      console.error(error);
      return;
    }

    const mapped = (data || []).map((item) => ({
      id: item.id,
      orderNo: item.order_no || "",
      orderDate: item.order_date || "",
      customer: item.customer || "",
      platform: item.platform || "",
      sku: item.sku || "",
      productName: item.product_name || "",
      variant: item.variant || "",
      qty: Number(item.qty || 0),
      preferredWarehouse: item.preferred_warehouse || "马来西亚仓库",
      status: item.status || "待采购",
      hasStock: !!item.has_stock,
      stockMessage: item.stock_message || "",
      isStockLocked: !!item.is_stock_locked,
      isStockOut: !!item.is_stock_out,
      stockOutDate: item.stock_out_date || "",
      visiblePurchaseUnitCostMyr: Number(item.visible_purchase_unit_cost_myr || 0),
      lockedUnitCostMyr: Number(item.locked_unit_cost_myr || 0),
      lockedTotalCostMyr: Number(item.locked_total_cost_myr || 0),
      isCostLocked: !!item.is_cost_locked,
      salePriceMyr: Number(item.sale_price_myr || 0),
      receivableMyr: Number(item.receivable_myr || 0),
      shippingFeeMyr: Number(item.shipping_fee_myr || 0),
      voucherMyr: Number(item.voucher_myr || 0),
      commissionFeeMyr: Number(item.commission_fee_myr || 0),
      transactionFeeMyr: Number(item.transaction_fee_myr || 0),
      otherDiscountMyr: Number(item.other_discount_myr || 0),
      otherFeeMyr: Number(item.other_fee_myr || 0),
      finalProfitMyr: Number(item.final_profit_myr || 0),
      isProfitFinalized: !!item.is_profit_finalized,
      notes: item.notes || "",
      createdAt: item.created_at || "",
    }));

    setOrders(mapped);
    setOrderForm(defaultOrder);
  };

  const toggleOrderLockStock = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order || order.isStockOut) return;

    const inventoryItem = getInventoryRecord(order.preferredWarehouse, order.sku, order.variant);
    if (!inventoryItem) {
      alert("找不到对应库存。");
      return;
    }

    if (!order.isStockLocked) {
      const available = getAvailableStock(order.preferredWarehouse, order.sku, order.variant);
      if (available < order.qty) {
        alert("可用库存不足，无法锁定。");
        return;
      }
      try {
        await upsertInventoryRecord({
          warehouse: order.preferredWarehouse,
          sku: order.sku,
          productName: order.productName,
          variant: order.variant,
          stockQty: inventoryItem.stockQty,
          lockedQty: num(inventoryItem.lockedQty) + num(order.qty),
          unitCostMyr: inventoryItem.unitCostMyr,
          supplier: inventoryItem.supplier,
        });
        await refreshInventoryFromSupabase();
      } catch (e) {
        alert("锁定库存失败");
        console.error(e);
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({
          is_stock_locked: true,
          has_stock: true,
          stock_message: "已锁定库存",
        })
        .eq("id", id);

      if (error) {
        alert("更新订单失败");
        console.error(error);
        return;
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, isStockLocked: true, hasStock: true, stockMessage: "已锁定库存" } : o
        )
      );
    } else {
      try {
        await upsertInventoryRecord({
          warehouse: order.preferredWarehouse,
          sku: order.sku,
          productName: order.productName,
          variant: order.variant,
          stockQty: inventoryItem.stockQty,
          lockedQty: Math.max(0, num(inventoryItem.lockedQty) - num(order.qty)),
          unitCostMyr: inventoryItem.unitCostMyr,
          supplier: inventoryItem.supplier,
        });
        await refreshInventoryFromSupabase();
      } catch (e) {
        alert("取消锁定库存失败");
        console.error(e);
        return;
      }
      const stockInfo = computeOrderStockStatus(order.preferredWarehouse, order.sku, order.variant, order.qty);

      const { error } = await supabase
        .from("orders")
        .update({
          is_stock_locked: false,
          has_stock: stockInfo.hasStock,
          stock_message: stockInfo.stockMessage,
        })
        .eq("id", id);

      if (error) {
        alert("更新订单失败");
        console.error(error);
        return;
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, isStockLocked: false, hasStock: stockInfo.hasStock, stockMessage: stockInfo.stockMessage } : o
        )
      );
    }
  };

  const stockOutOrder = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order || order.isStockOut) return;

    const inventoryItem = getInventoryRecord(order.preferredWarehouse, order.sku, order.variant);
    if (!inventoryItem) {
      alert("找不到对应库存。");
      return;
    }

    if (!order.isStockLocked) {
      const available = getAvailableStock(order.preferredWarehouse, order.sku, order.variant);
      if (available < order.qty) {
        alert("可用库存不足，无法出库。");
        return;
      }
    }

    const currentUnitCost = getCurrentUnitCost(order.preferredWarehouse, order.sku, order.variant);
    const lockedUnitCostMyr = currentUnitCost;
    const lockedTotalCostMyr = currentUnitCost * num(order.qty);

    try {
      await upsertInventoryRecord({
        warehouse: order.preferredWarehouse,
        sku: order.sku,
        productName: order.productName,
        variant: order.variant,
        stockQty: Math.max(0, num(inventoryItem.stockQty) - num(order.qty)),
        lockedQty: Math.max(0, num(inventoryItem.lockedQty) - (order.isStockLocked ? num(order.qty) : 0)),
        unitCostMyr: inventoryItem.unitCostMyr,
        supplier: inventoryItem.supplier,
      });
      await refreshInventoryFromSupabase();
    } catch (e) {
      alert("订单出库同步库存失败");
      console.error(e);
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        is_stock_locked: false,
        is_stock_out: true,
        stock_out_date: new Date().toLocaleString(),
        locked_unit_cost_myr: lockedUnitCostMyr,
        locked_total_cost_myr: lockedTotalCostMyr,
        is_cost_locked: true,
        visible_purchase_unit_cost_myr: lockedUnitCostMyr,
        status: "已发货",
        stock_message: "已出库",
        has_stock: true,
        is_profit_finalized: false,
      })
      .eq("id", id);

    if (error) {
      alert("订单出库失败");
      console.error(error);
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              isStockLocked: false,
              isStockOut: true,
              stockOutDate: new Date().toLocaleString(),
              lockedUnitCostMyr,
              lockedTotalCostMyr,
              isCostLocked: true,
              visiblePurchaseUnitCostMyr: lockedUnitCostMyr,
              status: "已发货",
              stockMessage: "已出库",
              hasStock: true,
              isProfitFinalized: false,
            }
          : o
      )
    );
  };

  const updateOrderField = async (id: string, field: keyof OrderRecord, value: string | number | boolean) => {
    const target = orders.find((o) => o.id === id);
    if (!target) return;

    const updated = { ...target, [field]: value } as OrderRecord;
    const currentUnitCost = updated.isCostLocked
      ? updated.lockedUnitCostMyr
      : getCurrentUnitCost(updated.preferredWarehouse, updated.sku, updated.variant);

    updated.visiblePurchaseUnitCostMyr = currentUnitCost;

    if (!updated.isStockLocked && !updated.isStockOut) {
      const stockInfo = computeOrderStockStatus(updated.preferredWarehouse, updated.sku, updated.variant, updated.qty);
      updated.hasStock = stockInfo.hasStock;
      updated.stockMessage = stockInfo.stockMessage;
    }

    if (updated.status === "已完成" && updated.isCostLocked) {
      updated.finalProfitMyr = num(updated.receivableMyr) - num(updated.lockedTotalCostMyr);
      updated.isProfitFinalized = true;
    } else if (updated.status !== "已完成") {
      updated.isProfitFinalized = false;
    }

    const payload = {
      order_no: updated.orderNo,
      order_date: updated.orderDate,
      customer: updated.customer,
      platform: updated.platform,
      sku: updated.sku,
      product_name: updated.productName,
      variant: updated.variant,
      qty: updated.qty,
      preferred_warehouse: updated.preferredWarehouse,
      status: updated.status,
      has_stock: updated.hasStock,
      stock_message: updated.stockMessage,
      is_stock_locked: updated.isStockLocked,
      is_stock_out: updated.isStockOut,
      stock_out_date: updated.stockOutDate,
      visible_purchase_unit_cost_myr: updated.visiblePurchaseUnitCostMyr,
      locked_unit_cost_myr: updated.lockedUnitCostMyr,
      locked_total_cost_myr: updated.lockedTotalCostMyr,
      is_cost_locked: updated.isCostLocked,
      sale_price_myr: updated.salePriceMyr,
      receivable_myr: updated.receivableMyr,
      shipping_fee_myr: updated.shippingFeeMyr,
      voucher_myr: updated.voucherMyr,
      commission_fee_myr: updated.commissionFeeMyr,
      transaction_fee_myr: updated.transactionFeeMyr,
      other_discount_myr: updated.otherDiscountMyr,
      other_fee_myr: updated.otherFeeMyr,
      final_profit_myr: updated.finalProfitMyr,
      is_profit_finalized: updated.isProfitFinalized,
      notes: updated.notes,
    };

    const { error } = await supabase.from("orders").update(payload).eq("id", id);

    if (error) {
      alert("更新订单失败");
      console.error(error);
      return;
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return updated;
      })
    );
  };

  const createTransfer = async () => {
    const matchedPurchases = purchases.filter((p) => transferPurchaseNoList.includes(p.purchaseNo.trim()));
    if (transferPurchaseNoList.length === 0 || matchedPurchases.length === 0) {
      alert("请输入一个或多个已有采购单号。");
      return;
    }
    if (transferForm.fromWarehouse === transferForm.toWarehouse) {
      alert("来源仓库和目标仓库不能相同。");
      return;
    }

    const items: TransferItem[] = [];
    for (const purchase of matchedPurchases) {
      const available = getAvailableStock(transferForm.fromWarehouse, purchase.sku, purchase.variant);
      if (purchase.warehouse !== transferForm.fromWarehouse) {
        alert(`采购单 ${purchase.purchaseNo} 不属于来源仓库。`);
        return;
      }
      if (available < purchase.qty) {
        alert(`来源仓库现货不足，无法调拨：${purchase.purchaseNo} / ${purchase.sku}`);
        return;
      }
      items.push({
        sku: purchase.sku,
        productName: purchase.productName,
        variant: purchase.variant,
        qty: purchase.qty,
        baseUnitCostMyr: getCurrentUnitCost(transferForm.fromWarehouse, purchase.sku, purchase.variant),
        allocatedFeePerUnitMyr: 0,
        finalUnitCostMyr: 0,
      });
    }

    const totalQty = items.reduce((s, i) => s + num(i.qty), 0);
    const feePerUnit = totalQty ? num(transferForm.transferFeeMyr) / totalQty : 0;
    const finalItems = items.map((i) => ({
      ...i,
      allocatedFeePerUnitMyr: feePerUnit,
      finalUnitCostMyr: num(i.baseUnitCostMyr) + feePerUnit,
    }));

    const payload = {
      transfer_no: `TRF-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
      purchase_nos: transferPurchaseNoList,
      from_warehouse: transferForm.fromWarehouse,
      to_warehouse: transferForm.toWarehouse,
      courier_company: transferForm.courierCompany,
      tracking_no: transferForm.trackingNo,
      transfer_fee_myr: num(transferForm.transferFeeMyr),
      status: transferForm.status,
      total_qty: totalQty,
      items: finalItems,
      is_source_synced: false,
      is_target_synced: false,
    };

    const { error: insertError } = await supabase.from("transfers").insert(payload);

    if (insertError) {
      alert("新增调拨单失败");
      console.error(insertError);
      return;
    }

    const { data, error } = await supabase
      .from("transfers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("刷新调拨单列表失败");
      console.error(error);
      return;
    }

    const mapped = (data || []).map((item) => ({
      id: item.id,
      transferNo: item.transfer_no || "",
      purchaseNos: Array.isArray(item.purchase_nos) ? item.purchase_nos : [],
      fromWarehouse: item.from_warehouse || "中国仓库",
      toWarehouse: item.to_warehouse || "马来西亚仓库",
      courierCompany: item.courier_company || "",
      trackingNo: item.tracking_no || "",
      transferFeeMyr: Number(item.transfer_fee_myr || 0),
      status: item.status || "待出库",
      totalQty: Number(item.total_qty || 0),
      items: Array.isArray(item.items) ? item.items : [],
      isSourceSynced: !!item.is_source_synced,
      isTargetSynced: !!item.is_target_synced,
      createdAt: item.created_at || "",
    }));

    setTransfers(mapped);
    setTransferForm(defaultTransfer);
  };

  const markTransferOutbound = async (id: string) => {
    const transfer = transfers.find((t) => t.id === id);
    if (!transfer || transfer.isSourceSynced) return;

    try {
      for (const item of transfer.items) {
        const inv = inventory.find(
          (row) =>
            row.warehouse === transfer.fromWarehouse &&
            row.sku.trim().toLowerCase() === item.sku.trim().toLowerCase() &&
            (row.variant || "") === (item.variant || "")
        );
        if (!inv) continue;

        await upsertInventoryRecord({
          warehouse: transfer.fromWarehouse,
          sku: item.sku,
          productName: item.productName,
          variant: item.variant,
          stockQty: Math.max(0, num(inv.stockQty) - num(item.qty)),
          lockedQty: inv.lockedQty,
          unitCostMyr: inv.unitCostMyr,
          supplier: inv.supplier,
        });
      }
      await refreshInventoryFromSupabase();
    } catch (e) {
      alert("调拨出库同步库存失败");
      console.error(e);
      return;
    }

    const { error } = await supabase
      .from("transfers")
      .update({
        status: "在途",
        is_source_synced: true,
      })
      .eq("id", id);

    if (error) {
      alert("更新调拨单失败");
      console.error(error);
      return;
    }

    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "在途", isSourceSynced: true } : t)));
  };

  const markTransferArrival = async (id: string) => {
    const transfer = transfers.find((t) => t.id === id);
    if (!transfer || transfer.isTargetSynced) return;

    try {
      for (const item of transfer.items) {
        const existingInv = inventory.find(
          (row) =>
            row.warehouse === transfer.toWarehouse &&
            row.sku.trim().toLowerCase() === item.sku.trim().toLowerCase() &&
            (row.variant || "") === (item.variant || "")
        );

        await upsertInventoryRecord({
          warehouse: transfer.toWarehouse,
          sku: item.sku,
          productName: item.productName,
          variant: item.variant,
          stockQty: (existingInv?.stockQty || 0) + num(item.qty),
          lockedQty: existingInv?.lockedQty || 0,
          unitCostMyr: item.finalUnitCostMyr,
          supplier: existingInv?.supplier || "调拨入库",
        });
      }
      await refreshInventoryFromSupabase();
    } catch (e) {
      alert("调拨到货同步库存失败");
      console.error(e);
      return;
    }

    const { error } = await supabase
      .from("transfers")
      .update({
        status: "已入库",
        is_target_synced: true,
      })
      .eq("id", id);

    if (error) {
      alert("更新调拨单失败");
      console.error(error);
      return;
    }

    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "已入库", isTargetSynced: true } : t)));
  };

  const toggleFeeOpen = (id: string) => {
    setOpenFeeRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      alert("删除商品失败");
      console.error(error);
      return;
    }

    setProducts((prev) => prev.filter((x) => x.id !== id));
  };
  const deleteExpense = (id: string) => setExpenses((prev) => prev.filter((x) => x.id !== id));
  const deletePurchase = async (id: string) => {
    const { error } = await supabase
      .from("purchases")
      .delete()
      .eq("id", id);

    if (error) {
      alert("删除采购单失败");
      console.error(error);
      return;
    }

    setPurchases((prev) => prev.filter((x) => x.id !== id));
  };
  const deleteTransfer = async (id: string) => {
    const { error } = await supabase
      .from("transfers")
      .delete()
      .eq("id", id);

    if (error) {
      alert("删除调拨单失败");
      console.error(error);
      return;
    }

    setTransfers((prev) => prev.filter((x) => x.id !== id));
  };
  const deleteInventory = async (id: string) => {
    const { error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", id);

    if (error) {
      alert("删除库存失败");
      console.error(error);
      return;
    }

    setInventory((prev) => prev.filter((x) => x.id !== id));
  };
  const deleteOrder = async (id: string) => {
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);

    if (error) {
      alert("删除订单失败");
      console.error(error);
      return;
    }

    setOrders((prev) => prev.filter((x) => x.id !== id));
  };

  const resetAll = () => {
    if (!confirm("确定清空所有资料吗？")) return;
    setProducts([]);
    setExpenses([]);
    setPurchases([]);
    setTransfers([]);
    setInventory([]);
    setOrders([]);
    Object.values(LS_KEYS).forEach((key) => localStorage.removeItem(key));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">ERP 重构版 V2</h1>
              <p className="mt-2 text-sm text-slate-600">
                增加不入库成本商品、采购单号调拨、订单费用展开编辑、发货前查看总采购成本、发货后锁定成本、完成后自动利润。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => downloadCSV("products.csv", products)}>
                <Download className="mr-2 h-4 w-4" />导出商品
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => downloadCSV("purchases.csv", purchases)}>
                <Download className="mr-2 h-4 w-4" />导出采购
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => downloadCSV("orders.csv", orders)}>
                <Download className="mr-2 h-4 w-4" />导出订单
              </Button>
              <Button variant="destructive" className="rounded-2xl" onClick={resetAll}>
                <RotateCcw className="mr-2 h-4 w-4" />清空资料
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="商品数量" value={products.length} icon={<ImageIcon className="h-4 w-4" />} />
          <StatCard title="不入库成本" value={money(summary.totalExpenseCost)} icon={<PackageCheck className="h-4 w-4" />} />
          <StatCard title="采购单" value={purchases.length} icon={<ClipboardList className="h-4 w-4" />} />
          <StatCard title="调拨单" value={transfers.length} icon={<ArrowRightLeft className="h-4 w-4" />} />
          <StatCard title="库存总数量" value={summary.totalInventoryQty} icon={<Boxes className="h-4 w-4" />} />
          <StatCard title="已完成利润" value={money(summary.totalProfitCompleted)} icon={<ShoppingCart className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="product" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-6 rounded-2xl p-1">
            <TabsTrigger value="product" className="py-3">商品管理</TabsTrigger>
            <TabsTrigger value="purchase" className="py-3">采购单管理</TabsTrigger>
            <TabsTrigger value="transfer" className="py-3">调拨单管理</TabsTrigger>
            <TabsTrigger value="inventory" className="py-3">库存查询</TabsTrigger>
            <TabsTrigger value="order-create" className="py-3">订单录入</TabsTrigger>
            <TabsTrigger value="order-list" className="py-3">订单总览</TabsTrigger>
          </TabsList>

          <TabsContent value="product">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-3xl shadow-sm lg:col-span-2">
                  <CardHeader><CardTitle>商品管理</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="中文名称"><Input value={productForm.chineseName} onChange={(e) => setProductForm({ ...productForm, chineseName: e.target.value })} /></Field>
                    <Field label="型号"><Input value={productForm.model} onChange={(e) => setProductForm({ ...productForm, model: e.target.value })} /></Field>
                    <Field label="规格"><Input value={productForm.spec} onChange={(e) => setProductForm({ ...productForm, spec: e.target.value })} /></Field>
                    <Field label="SKU"><Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} /></Field>
                    <Field label="图片链接"><Input value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} /></Field>
                    <Field label="上传图片"><Input type="file" accept="image/*" onChange={(e) => handleProductImageUpload(e.target.files?.[0] || null)} /></Field>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl shadow-sm">
                  <CardHeader><CardTitle>图片预览</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <ProductImagePreview imageUrl={productForm.imageUrl} altText={productForm.chineseName || productForm.sku || "商品图片"} />
                    <Button className="w-full rounded-2xl" onClick={saveProduct}><Plus className="mr-2 h-4 w-4" />保存商品</Button>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-3xl shadow-sm lg:col-span-2">
                  <CardHeader><CardTitle>不需要入库的成本商品</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <Field label="成本名称"><Input value={expenseForm.name} onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })} placeholder="例如：包裹袋子 / 打印机 / 面单 / 其他" /></Field>
                    <Field label="金额 MYR"><Input type="number" value={expenseForm.amountMyr} onChange={(e) => setExpenseForm({ ...expenseForm, amountMyr: Number(e.target.value) })} /></Field>
                    <Field label="备注"><Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></Field>
                  </CardContent>
                  <CardContent>
                    <Button className="rounded-2xl" onClick={saveExpense}><Plus className="mr-2 h-4 w-4" />添加成本项目</Button>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl shadow-sm">
                  <CardHeader><CardTitle>成本说明</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border bg-slate-50 p-4">这些项目不会进入库存，只做额外成本记录。</div>
                    <div className="rounded-2xl border bg-slate-50 p-4">可记录：包裹袋子、打印机、面单、其他成本。</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>商品列表</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>图片</TableHead>
                          <TableHead>中文名称</TableHead>
                          <TableHead>型号</TableHead>
                          <TableHead>规格</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>中国仓库存</TableHead>
                          <TableHead>中国仓在途</TableHead>
                          <TableHead>马来西亚库存</TableHead>
                          <TableHead>马来西亚在途</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.length === 0 ? (
                          <TableRow><TableCell colSpan={10} className="py-8 text-center text-slate-500">还没有商品资料</TableCell></TableRow>
                        ) : (
                          products.map((item) => {
                            const s = inventoryStatsBySku.get(item.sku) || {
                              chinaStock: 0, chinaInTransit: 0, malaysiaStock: 0, malaysiaInTransit: 0
                            };
                            return (
                              <TableRow key={item.id}>
                                <TableCell><Thumb imageUrl={item.imageUrl} altText={item.chineseName} /></TableCell>
                                <TableCell className="font-medium">{item.chineseName}</TableCell>
                                <TableCell>{item.model || "-"}</TableCell>
                                <TableCell>{item.spec || "-"}</TableCell>
                                <TableCell>{item.sku}</TableCell>
                                <TableCell>{s.chinaStock}</TableCell>
                                <TableCell>{s.chinaInTransit}</TableCell>
                                <TableCell>{s.malaysiaStock}</TableCell>
                                <TableCell>{s.malaysiaInTransit}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" onClick={() => deleteProduct(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>不入库成本列表</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>名称</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>备注</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">还没有额外成本</TableCell></TableRow>
                        ) : (
                          expenses.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{money(item.amountMyr)}</TableCell>
                              <TableCell>{item.notes || "-"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => deleteExpense(item.id)}><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="purchase">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-3xl shadow-sm lg:col-span-2">
                  <CardHeader><CardTitle>新增采购单</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="采购单号"><Input value={purchaseForm.purchaseNo} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseNo: e.target.value })} /></Field>
                    <Field label="采购日期"><Input type="date" value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} /></Field>
                    <Field label="入库仓库">
                      <select value={purchaseForm.warehouse} onChange={(e) => setPurchaseForm({ ...purchaseForm, warehouse: e.target.value as WarehouseName })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </Field>
                    <Field label="供应商"><Input value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} /></Field>
                    <Field label="SKU">
                      <Input
                        value={purchaseForm.sku}
                        onChange={(e) => {
                          const sku = e.target.value;
                          const matched = getProductBySku(sku);
                          setPurchaseForm((prev) => ({
                            ...prev,
                            sku,
                            productName: matched?.chineseName || prev.productName,
                            variant: matched?.spec || prev.variant,
                          }));
                        }}
                      />
                    </Field>
                    <Field label="产品名称"><Input value={purchaseForm.productName} onChange={(e) => setPurchaseForm({ ...purchaseForm, productName: e.target.value })} /></Field>
                    <Field label="规格"><Input value={purchaseForm.variant} onChange={(e) => setPurchaseForm({ ...purchaseForm, variant: e.target.value })} /></Field>
                    <Field label="采购数量"><Input type="number" value={purchaseForm.qty} onChange={(e) => setPurchaseForm({ ...purchaseForm, qty: Number(e.target.value) })} /></Field>
                    <Field label="采购马币总额 MYR"><Input type="number" value={purchaseForm.totalPurchaseMyr} onChange={(e) => setPurchaseForm({ ...purchaseForm, totalPurchaseMyr: Number(e.target.value) })} /></Field>
                    <Field label="运单号"><Input value={purchaseForm.trackingNo} onChange={(e) => setPurchaseForm({ ...purchaseForm, trackingNo: e.target.value })} /></Field>
                    <Field label="采购状态">
                      <select value={purchaseForm.status} onChange={(e) => setPurchaseForm({ ...purchaseForm, status: e.target.value as PurchaseStatus })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {PURCHASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl shadow-sm">
                  <CardHeader><CardTitle>采购预览</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <ProductImagePreview imageUrl={productByPurchaseSku?.imageUrl || ""} altText={purchaseForm.sku || "采购图片"} />
                    <Result title="采购总额 MYR" value={money(purchaseCalc.totalPurchaseMyr)} />
                    <Result title="单件采购价 MYR" value={money(purchaseCalc.unitCostMyr)} />
                    <Result title="当前成本价 MYR" value={money(purchaseCalc.unitCostMyr)} />
                    <Button className="w-full rounded-2xl" onClick={savePurchase}><Plus className="mr-2 h-4 w-4" />保存采购单</Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>所有采购订单</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>采购单号</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead>仓库</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>成本价</TableHead>
                          <TableHead>运单号</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>签收入库</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases.length === 0 ? (
                          <TableRow><TableCell colSpan={11} className="py-8 text-center text-slate-500">还没有采购单</TableCell></TableRow>
                        ) : (
                          purchases.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.purchaseNo}</TableCell>
                              <TableCell>{item.purchaseDate}</TableCell>
                              <TableCell>{item.warehouse}</TableCell>
                              <TableCell>{item.sku}</TableCell>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.qty}</TableCell>
                              <TableCell>{money(item.unitCostMyr)}</TableCell>
                              <TableCell>{item.trackingNo || "-"}</TableCell>
                              <TableCell>{item.status}</TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" disabled={item.isInventorySynced} onClick={() => markPurchaseSigned(item.id)}>
                                  {item.isInventorySynced ? "已入库" : "签收入库"}
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => deletePurchase(item.id)}><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transfer">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-3xl shadow-sm lg:col-span-2">
                  <CardHeader><CardTitle>新增调拨单</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="多个采购单号"><Input value={transferForm.purchaseNosText} onChange={(e) => setTransferForm({ ...transferForm, purchaseNosText: e.target.value })} placeholder="可用逗号或换行分开" /></Field>
                    <Field label="调拨单号"><Input value={transferPurchaseNoList.length ? "自动生成" : "请输入采购单号"} disabled /></Field>
                    <Field label="来源仓库">
                      <select value={transferForm.fromWarehouse} onChange={(e) => setTransferForm({ ...transferForm, fromWarehouse: e.target.value as WarehouseName })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </Field>
                    <Field label="目标仓库">
                      <select value={transferForm.toWarehouse} onChange={(e) => setTransferForm({ ...transferForm, toWarehouse: e.target.value as WarehouseName })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </Field>
                    <Field label="快递公司"><Input value={transferForm.courierCompany} onChange={(e) => setTransferForm({ ...transferForm, courierCompany: e.target.value })} /></Field>
                    <Field label="运单号"><Input value={transferForm.trackingNo} onChange={(e) => setTransferForm({ ...transferForm, trackingNo: e.target.value })} /></Field>
                    <Field label="运费 MYR"><Input type="number" value={transferForm.transferFeeMyr} onChange={(e) => setTransferForm({ ...transferForm, transferFeeMyr: Number(e.target.value) })} /></Field>
                    <Field label="调拨状态">
                      <select value={transferForm.status} onChange={(e) => setTransferForm({ ...transferForm, status: e.target.value as TransferStatus })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {TRANSFER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl shadow-sm">
                  <CardHeader><CardTitle>采购单号商品</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {transferCandidates.length === 0 ? (
                      <div className="rounded-2xl border bg-slate-50 p-4 text-slate-500">输入多个采购单号后，这里会显示对应商品和数量。</div>
                    ) : (
                      transferCandidates.map((item) => (
                        <div key={item.id} className="rounded-2xl border bg-slate-50 p-4">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-slate-500">{item.purchaseNo} / {item.sku} / {item.variant || "-"}</div>
                          <div className="mt-1">数量：{item.qty}</div>
                        </div>
                      ))
                    )}
                    <Button className="w-full rounded-2xl" onClick={createTransfer}><Plus className="mr-2 h-4 w-4" />保存调拨单</Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>所有调拨单</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>调拨单号</TableHead>
                          <TableHead>采购单号</TableHead>
                          <TableHead>来源仓库</TableHead>
                          <TableHead>目标仓库</TableHead>
                          <TableHead>快递公司</TableHead>
                          <TableHead>运单号</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>出库</TableHead>
                          <TableHead>到货入库</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.length === 0 ? (
                          <TableRow><TableCell colSpan={11} className="py-8 text-center text-slate-500">还没有调拨单</TableCell></TableRow>
                        ) : (
                          transfers.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.transferNo}</TableCell>
                              <TableCell>{item.purchaseNos.join(", ")}</TableCell>
                              <TableCell>{item.fromWarehouse}</TableCell>
                              <TableCell>{item.toWarehouse}</TableCell>
                              <TableCell>{item.courierCompany || "-"}</TableCell>
                              <TableCell>{item.trackingNo || "-"}</TableCell>
                              <TableCell>{item.status}</TableCell>
                              <TableCell>{item.totalQty}</TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" disabled={item.isSourceSynced} onClick={() => markTransferOutbound(item.id)}>
                                  {item.isSourceSynced ? "已出库" : "出库"}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" disabled={!item.isSourceSynced || item.isTargetSynced} onClick={() => markTransferArrival(item.id)}>
                                  {item.isTargetSynced ? "已入目标仓" : "到货入库"}
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => deleteTransfer(item.id)}><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="space-y-6">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>库存查询</CardTitle></CardHeader>
                <CardContent>
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input className="pl-9" value={inventoryKeyword} onChange={(e) => setInventoryKeyword(e.target.value)} placeholder="搜索 SKU / 产品名称 / 规格 / 仓库" />
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>库存列表</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>仓库</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>规格</TableHead>
                          <TableHead>现货库存</TableHead>
                          <TableHead>锁定库存</TableHead>
                          <TableHead>可用库存</TableHead>
                          <TableHead>成本价</TableHead>
                          <TableHead>单件成本</TableHead>
                          <TableHead>供应商</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.length === 0 ? (
                          <TableRow><TableCell colSpan={11} className="py-8 text-center text-slate-500">没有找到库存记录</TableCell></TableRow>
                        ) : (
                          filteredInventory.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.warehouse}</TableCell>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.sku}</TableCell>
                              <TableCell>{item.variant || "-"}</TableCell>
                              <TableCell>{item.stockQty}</TableCell>
                              <TableCell>{item.lockedQty}</TableCell>
                              <TableCell>{num(item.stockQty) - num(item.lockedQty)}</TableCell>
                              <TableCell>{money(item.unitCostMyr)}</TableCell>
                              <TableCell>{money(item.unitCostMyr)}</TableCell>
                              <TableCell>{item.supplier || "-"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => deleteInventory(item.id)}><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="order-create">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="rounded-3xl shadow-sm lg:col-span-2">
                <CardHeader><CardTitle>订单录入</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="订单号"><Input value={orderForm.orderNo} onChange={(e) => setOrderForm({ ...orderForm, orderNo: e.target.value })} /></Field>
                  <Field label="订单日期"><Input type="date" value={orderForm.orderDate} onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })} /></Field>
                  <Field label="平台"><Input value={orderForm.platform} onChange={(e) => setOrderForm({ ...orderForm, platform: e.target.value })} /></Field>
                  <Field label="客户"><Input value={orderForm.customer} onChange={(e) => setOrderForm({ ...orderForm, customer: e.target.value })} /></Field>
                  <Field label="优先仓库">
                    <select value={orderForm.preferredWarehouse} onChange={(e) => setOrderForm({ ...orderForm, preferredWarehouse: e.target.value as WarehouseName })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </Field>
                  <Field label="SKU">
                    <Input
                      value={orderForm.sku}
                      onChange={(e) => {
                        const sku = e.target.value;
                        const matched = getProductBySku(sku);
                        setOrderForm((prev) => ({
                          ...prev,
                          sku,
                          productName: matched?.chineseName || prev.productName,
                          variant: matched?.spec || prev.variant,
                        }));
                      }}
                    />
                  </Field>
                  <Field label="产品名称"><Input value={orderForm.productName} onChange={(e) => setOrderForm({ ...orderForm, productName: e.target.value })} /></Field>
                  <Field label="规格"><Input value={orderForm.variant} onChange={(e) => setOrderForm({ ...orderForm, variant: e.target.value })} /></Field>
                  <Field label="数量"><Input type="number" value={orderForm.qty} onChange={(e) => setOrderForm({ ...orderForm, qty: Number(e.target.value) })} /></Field>
                  <Field label="备注"><Input value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} /></Field>
                </CardContent>
              </Card>
              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>订单预览</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <ProductImagePreview imageUrl={productByOrderSku?.imageUrl || ""} altText={orderForm.sku || "订单商品图片"} />
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
                    创建后会自动判断有没有库存，并自动带出当前总采购成本。
                  </div>
                  <Button className="w-full rounded-2xl" onClick={createOrder}><Plus className="mr-2 h-4 w-4" />保存订单</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="order-list">
            <div className="space-y-6">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>订单筛选</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <Field label="搜索"><Input value={orderKeyword} onChange={(e) => setOrderKeyword(e.target.value)} placeholder="订单号 / SKU / 产品名称 / 客户" /></Field>
                  <Field label="订单状态">
                    <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value as "全部" | OrderStatus)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="全部">全部</option>
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="仓库">
                    <select value={orderWarehouseFilter} onChange={(e) => setOrderWarehouseFilter(e.target.value as "全部" | WarehouseName)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="全部">全部</option>
                      {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </Field>
                  <Field label="库存状态">
                    <select value={orderStockFilter} onChange={(e) => setOrderStockFilter(e.target.value as "全部" | "有库存" | "无库存")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="全部">全部</option>
                      <option value="有库存">有库存</option>
                      <option value="无库存">无库存</option>
                    </select>
                  </Field>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader><CardTitle>所有订单</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>订单号</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead>仓库</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>库存状态</TableHead>
                          <TableHead>总采购成本</TableHead>
                          <TableHead>费用</TableHead>
                          <TableHead>锁库存</TableHead>
                          <TableHead>出库</TableHead>
                          <TableHead>利润</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.length === 0 ? (
                          <TableRow><TableCell colSpan={13} className="py-8 text-center text-slate-500">没有订单记录</TableCell></TableRow>
                        ) : (
                          filteredOrders.map((item) => {
                            const profitCompleted = item.isProfitFinalized
                              ? num(item.finalProfitMyr)
                              : null;
                            const feeOpen = !!openFeeRows[item.id];

                            return (
                              <React.Fragment key={item.id}>
                                <TableRow>
                                  <TableCell>
                                    <div className="font-medium">{item.orderNo}</div>
                                    <div className="text-xs text-slate-500">{item.orderDate || "无日期"}</div>
                                  </TableCell>
                                  <TableCell>
                                    <select
                                      value={item.status}
                                      onChange={(e) => updateOrderField(item.id, "status", e.target.value as OrderStatus)}
                                      className="h-9 rounded-md border px-2 text-sm"
                                    >
                                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </TableCell>
                                  <TableCell>{item.sku}</TableCell>
                                  <TableCell>{item.productName}</TableCell>
                                  <TableCell>
                                    <select
                                      value={item.preferredWarehouse}
                                      onChange={(e) => updateOrderField(item.id, "preferredWarehouse", e.target.value as WarehouseName)}
                                      className="h-9 rounded-md border px-2 text-sm"
                                    >
                                      {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                  </TableCell>
                                  <TableCell>{item.qty}</TableCell>
                                  <TableCell>
                                    {item.isStockOut ? (
                                      <Badge>已出库</Badge>
                                    ) : item.hasStock ? (
                                      <Badge variant="secondary">{item.stockMessage}</Badge>
                                    ) : (
                                      <Badge variant="destructive">{item.stockMessage}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div>{money(item.isCostLocked ? item.lockedTotalCostMyr : item.visiblePurchaseUnitCostMyr * item.qty)}</div>
                                    <div className="text-xs text-slate-500">
                                      {item.isCostLocked ? "已锁定" : "未锁定"}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="outline" size="sm" onClick={() => toggleFeeOpen(item.id)}>
                                      <ChevronsUpDown className="mr-2 h-4 w-4" />
                                      {feeOpen ? "隐藏" : "打开"}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="outline" size="sm" disabled={item.isStockOut} onClick={() => toggleOrderLockStock(item.id)}>
                                      {item.isStockLocked ? "取消锁定" : "锁定库存"}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="outline" size="sm" disabled={item.isStockOut} onClick={() => stockOutOrder(item.id)}>
                                      {item.isStockOut ? "已发货" : "发货"}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    {profitCompleted !== null ? (
                                      <span className={profitCompleted >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                        {money(profitCompleted)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">未完成</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => deleteOrder(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                  </TableCell>
                                </TableRow>
                                {feeOpen && (
                                  <TableRow>
                                    <TableCell colSpan={13}>
                                      <div className="grid gap-3 md:grid-cols-4 p-3 bg-slate-50 rounded-2xl">
                                        <FeeInput label="售价" value={item.salePriceMyr} onChange={(v) => updateOrderField(item.id, "salePriceMyr", v)} />
                                        <FeeInput label="应收货款" value={item.receivableMyr} onChange={(v) => updateOrderField(item.id, "receivableMyr", v)} />
                                        <FeeInput label="佣金" value={item.commissionFeeMyr} onChange={(v) => updateOrderField(item.id, "commissionFeeMyr", v)} />
                                        <FeeInput label="手续费" value={item.transactionFeeMyr} onChange={(v) => updateOrderField(item.id, "transactionFeeMyr", v)} />
                                        <FeeInput label="优惠卷" value={item.voucherMyr} onChange={(v) => updateOrderField(item.id, "voucherMyr", v)} />
                                        <FeeInput label="其他折扣" value={item.otherDiscountMyr} onChange={(v) => updateOrderField(item.id, "otherDiscountMyr", v)} />
                                        <FeeInput label="运费" value={item.shippingFeeMyr} onChange={(v) => updateOrderField(item.id, "shippingFeeMyr", v)} />
                                        <FeeInput label="其他费用" value={item.otherFeeMyr} onChange={(v) => updateOrderField(item.id, "otherFeeMyr", v)} />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-4">
                <ResultCard title="总应收货款" value={money(summary.totalReceivable)} />
                <ResultCard title="已锁定总成本" value={money(summary.totalLockedCost)} />
                <ResultCard title="已完成订单利润" value={money(summary.totalProfitCompleted)} />
                <ResultCard title="额外成本总额" value={money(summary.totalExpenseCost)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Result({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function ResultCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-500">{icon}<span>{title}</span></div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ProductImagePreview({ imageUrl, altText }: { imageUrl: string; altText: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      {imageUrl ? (
        <img src={imageUrl} alt={altText} className="h-48 w-full rounded-xl bg-white object-contain" />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed bg-white text-slate-400">暂无图片</div>
      )}
    </div>
  );
}

function Thumb({ imageUrl, altText }: { imageUrl: string; altText: string }) {
  return imageUrl ? (
    <img src={imageUrl} alt={altText} className="h-12 w-12 rounded-lg border object-cover" />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border text-slate-400">-</div>
  );
}

function FeeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
