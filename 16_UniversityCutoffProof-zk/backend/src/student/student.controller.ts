import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { StudentService } from "./student.service";
import {
  CreateStudentAuxiliaryRecordDto,
  StudentCurrentApplicationDto,
  StudentEligibilityDto,
  StudentWorkbenchDto
} from "./student.dto";
import { StudentApplicationDto, StudentAuxiliaryRecordDto } from "../common/response.dto";

// 学生控制器默认全部公开读取。
// 当前版本下，学生资格与申请记录不要求后台会话，只有“辅助记录写入”会落后端数据库。
@ApiTags("student")
@Controller("api/students/:wallet")
export class StudentController {
  constructor(
    @Inject(StudentService)
    private readonly studentService: StudentService
  ) {}

  // 学生首页和申请页统一依赖的主读接口。
  @Get("workbench")
  @ApiOkResponse({ description: "学生工作台聚合数据", type: StudentWorkbenchDto })
  async getWorkbench(@Param("wallet") wallet: string) {
    return this.studentService.getWorkbench(wallet);
  }

  @Get("applications")
  @ApiOkResponse({ type: [StudentApplicationDto] })
  async getApplications(@Param("wallet") wallet: string) {
    return this.studentService.getApplications(wallet);
  }

  @Get("current-application")
  @ApiOkResponse({ type: StudentCurrentApplicationDto })
  async getCurrentApplication(@Param("wallet") wallet: string) {
    return this.studentService.getCurrentApplication(wallet);
  }

  @Get("eligibility")
  @ApiOkResponse({ type: StudentEligibilityDto })
  async getEligibility(@Param("wallet") wallet: string) {
    return this.studentService.getEligibility(wallet);
  }

  // 这里只写“未上链辅助记录”，例如未达线阻断，不改变链上申请真相。
  @Post("auxiliary-records")
  @ApiCreatedResponse({ type: StudentAuxiliaryRecordDto })
  async createAuxiliaryRecord(
    @Param("wallet") wallet: string,
    @Body() dto: CreateStudentAuxiliaryRecordDto
  ) {
    return this.studentService.createAuxiliaryRecord(wallet, dto);
  }
}
